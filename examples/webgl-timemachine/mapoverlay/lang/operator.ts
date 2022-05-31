import {$err, $iter, $type, $util} from "../common";

import type {
    Mapping, ParameterType, Predicate, Prototype,
    Signature, Some, UnitOrArray
} from "../types";

export function op<T = any>(
    domain: (Parameter | ParameterType)[],
    prototype: Prototype<T>,
    commutative: boolean = false): Operator<T> {
    return new Operator<T>(domain, prototype, commutative);
}

export class Parameter {
    private static _Empty: Parameter;

    private readonly _dtypes: UnitOrArray<string>;
    private readonly _clause: Some<Predicate>;
    private readonly _restrictions: Some<Iterable<any>>
    private readonly _optional: boolean;
    private readonly _variadic: boolean;

    constructor(types?: ParameterType, variadic: boolean = false, optional: boolean = false) {

        [this._dtypes, this._clause, this._restrictions] = [[], undefined, undefined];
        [this._optional, this._variadic] = [false, false];

        if (types) {
            [this._dtypes, this._clause, this._restrictions] = this._resolveParameter(types);
            [this._optional, this._variadic] = [optional || variadic, variadic];
        }
    }

    static get empty(): Parameter {
        if (Parameter._Empty == undefined)
            Parameter._Empty = new Parameter();

        return Parameter._Empty;
    }

    static optional(types: ParameterType): Parameter {
        return new Parameter(types, false, true);
    }

    static variadic(types: ParameterType): Parameter {
        return new Parameter(types, true, true);
    }

    get clause(): Some<Predicate> {
        return this._clause;
    }

    get datatypes(): UnitOrArray<string> {
        return this._dtypes;
    }

    get isEmpty(): boolean {
        return this._dtypes.length === 0
            && this._restrictions == undefined && this._clause == undefined;
    }

    get isOptional(): boolean {
        return this._optional;
    }

    get isVariadic(): boolean {
        return this._variadic;
    }

    accepts(arg: any): boolean {
        if (this.isEmpty)
            return false;

        const [dtypes, clause] = [this._dtypes, this._clause];

        return (typeof dtypes === "string"
            ? $type.isOf(arg, dtypes)
            : $type.isOfOne(arg, dtypes)) && (!clause || clause(arg));
    }

    acceptsAll(args: any[]): boolean {
        return args.length === 0
            ? this.isEmpty || this._optional
            : args.length === 1
                ? this.accepts(args[0])
                : this._variadic && args.every(arg => this.accepts(arg));
    }

    equals(_: Parameter): boolean {
        return this === _ || this.is(_);
    }

    is(datatypes: UnitOrArray<string> | Parameter): boolean {
        if (!(typeof datatypes === "string" || Array.isArray(datatypes)))
            return this._compareToParameter(datatypes);

        if (this._clause)
            return false;

        if (typeof this._dtypes === "string")
            return this._dtypes === datatypes;

        return Array.isArray(datatypes) && $iter.similar(this._dtypes, datatypes);
    }

    takes(arg: any): boolean {
        if (this.isEmpty)
            return false;

        return (Array.isArray(this._dtypes)
            ? $type.isKindOfOne(arg, this._dtypes)
            : $type.isKindOf(arg, this._dtypes)) && (!this._clause || this._clause(arg))
    }

    private _compareToParameter(parameter: Parameter): boolean {
        if (this.isEmpty && parameter.isEmpty)
            return true;

        const argCompatible = (this._optional == parameter._optional) && (this._variadic == parameter._variadic);

        if (!argCompatible)
            return false;

        const dtypes = this._dtypes

        let typeCompatible = typeof dtypes === "string"
            ? dtypes === parameter._dtypes
            : $iter.similar(dtypes, parameter._dtypes);

        typeCompatible &&=
                ((parameter._restrictions && this._restrictions
                        && $iter.similar(this._restrictions, parameter._restrictions))
                    || !(parameter._restrictions || this._restrictions));

        return typeCompatible
            && (!(parameter._clause || this._clause) || parameter === this);
    }

    private _resolveParameter(parameter: ParameterType): [UnitOrArray<string>, Some<Predicate>, Some<Iterable<any>>] {
        const nparameter = $type.normalizeType(parameter);

        if (typeof nparameter === "string")
            return [nparameter, undefined, undefined];

        if ("type" in nparameter) {
            if ("clause" in nparameter)
                return [nparameter.type, nparameter.clause, undefined]

            return [
                nparameter.type,
                (_: any) => $iter.has(nparameter.restrictions, _),
                nparameter.restrictions
            ]
        }

        return [nparameter, undefined, undefined]
    }
}

export class Operator<T = any> {
    private readonly _domain: Parameter[];
    private readonly _signature: Signature;
    private readonly _prototype: Prototype<T>;

    constructor(
        parameters: (Parameter | ParameterType)[],
        prototype: Prototype<T>,
        commutative: boolean = false) {

        const domain = parameters.map(type => type instanceof Parameter ? type : new Parameter(<ParameterType>type));

        this._domain = Operator._validateDomain(domain);
        this._prototype = prototype;
        this._signature = {
            arity: prototype.length,
            rank: domain.length,
            commutative: commutative,
            variadic: domain.length > 0 && $iter.last(domain)!.isVariadic
        }
    }

    get domain(): Parameter[] {
        return this._domain;
    }

    get prototype(): Prototype<T> {
        return this._prototype;
    }

    get signature(): Signature {
        return this._signature;
    }

    call = (...args: any[]): any => this._callWith(args);

    private static _validateDomain(domain: Parameter[]): Parameter[] {
        if (domain.length === 0)
            return domain;

        if (domain.length > 1 && domain.some(p => p.isEmpty))
            throw $err.Invalid("Domain", `Empty parameter in domain: {${$util.stringify(...domain)}`);

        let mustBeOptional = false;
        const n = domain.length;

        for (const [i, parameter] of domain.entries()) {
            if (parameter.isVariadic && (i < (n - 1)))
                throw $err.Invalid("Domain",
                    "Expected variadic parameter to be last in domain.");

            if (!parameter.isOptional && mustBeOptional)
                throw $err.Invalid("Domain",
                    "Required parameter after optional parameter in domain.");

            mustBeOptional = parameter.isOptional;
        }

        return domain;
    }

    private _callWith(args: any[]) {
        if (!this._typeChecker(args))
            throw $err.Invalid(
                "Operation :: .call",
                `Function does not accept given args: [${$util.stringify(...args)}].`);

        return this._prototype(...args);
    }

    private _typeChecker(args: any[]): boolean {
        const {arity, rank, commutative, variadic} = this._signature;
        const n = args.length;

        if (n === 0 && arity === 0)
            return true;

        if (n < arity || (n > rank && !variadic))
            return false;

        const ofType = this._typeCheckArguments(args);
        return ofType && (!commutative || this._typeCheckArguments(args.reverse()));
    }

    private _typeCheckArguments(args: any[]): boolean {
        const {arity, rank} = this._signature;
        let ofType = this._domain.slice(0, arity).every((p, i) => p.accepts(args[i]));

        if (args.length === arity)
            return ofType;

        ofType &&= this._domain.slice(arity, rank - 1).every((p, i) => p.accepts(args[i + arity]));

        if (args.length < rank)
            return ofType;

        const last = $iter.last(this._domain);

        return ofType && args.slice(arity + rank - 1).every(arg => last!.accepts(arg));
    }
}

export class OverloadedOperator {
    private _head: Some<ParameterNode>;
    private _tail: Some<ParameterNode>;
    private _size: number;

    constructor() {
        this._head = this._tail = undefined;
        this._size = 0;
    }

    add(op: Operator) {
        const nodes = this._appendOperator(op);
        nodes.forEach(node => node.value.push(op));
    }

    call(...args: any[]): any {
        let funcs = this._findOperator(args)?.value ?? [];

        if (funcs.length === 0)
            throw $err.Invalid(
                `Operation::.${this.call.name}`,
                `No implementation for given args: (${$util.stringify(...args)})`);

        return funcs[0].call(...args);
    }

    clear(): void {
        this._size = 0;
        this._clearNodes();
    }

    get(domain: UnitOrArray<Parameter>): Operator[] {
        return this._getDomain(OverloadedOperator._wrapDomain(domain))?.value ?? [];
    }

    has(domain: UnitOrArray<Parameter>): boolean {
        return !!this._getDomain(OverloadedOperator._wrapDomain(domain));
    }

    overload(...funcs: Operator[]): void {
        funcs.forEach(f => this.add(f));
    }

    operators(): Operator[] {
        const ops: Operator[] = [];
        let node = this._head;

        while (node) {

            if (node.value.length > 0)
                ops.push(...node.value);

            if (node.children)
                ops.push(...node.children.operators());

            node = node.next;
        }

        return ops;
    }

    remove(domain: UnitOrArray<Parameter>): void {
        domain = OverloadedOperator._wrapDomain(domain);
        let node = this._getDomain(domain);

        if (!node)
            return;

        if (node.value.length > 0) {
            this._size -= node.value.length;
            node.value.length = 0;
        }
    }

    supports(args: any[]): boolean {
        return this._hasNode(args);
    }

    private static _makeNode(parameter: Parameter, isParent: boolean = false): ParameterNode {
        return {
            children: isParent ? new OverloadedOperator() : undefined,
            previous: undefined,
            next: undefined,
            key: parameter,
            value: []
        }
    }

    private static _wrapDomain(domain: UnitOrArray<Parameter>): Parameter[] {
        return Array.isArray(domain)
            ? domain.length === 0
                ? [Parameter.empty]
                : domain
            : [domain];
    }

    private _appendOperator(op: Operator): ParameterNode[] {
        const {arity, rank} = op.signature;
        const domain = op.domain.length > 0 ? op.domain : [Parameter.empty];

        let operator: Some<OverloadedOperator> = this;
        let node: Some<ParameterNode>;
        let nodes: ParameterNode[] = [];

        domain.forEach((parameter, i) => {
            node = operator!._getNode(parameter);

            if (!node) {
                node = OverloadedOperator._makeNode(parameter, i < (rank - 1));
                operator!._appendNode(node);
            }

            if (i >= (arity - 1))
                nodes.push(node);

            operator = node.children;
        });

        return nodes;
    }

    private _appendNode(node: ParameterNode): void {
        if (!this._head) {
            this._tail = this._head = node;
            this._size++;
            return;
        }

        this._tail!.next = node;
        node.previous = this._tail;
        this._tail = node;
        this._size++;
        return;
    }

    private _clearNodes(): void {
        let node = this._head;

        while (node) {
            const next = node.next;
            node.children?.clear();
            node.previous = node.next = undefined;
            node.value.length = 0;
            node = next;
        }

        this._head = this._tail = undefined;
    }

    private _findNode(arg: any, from: Some<ParameterNode> = undefined) {
        return this._whereNode(p => p.takes(arg), from) ||
            this._whereNode(p => p.accepts(arg), from);
    }
    
    private _findOperator(args: any[]): Some<ParameterNode> {
        if (args.length === 0)
            return this._findOptionalNode();
        
        if (args.length === 1)
            return this._findOperatorNode(args[0]);

        let node = this._findNode(args[0]);
        let op: Some<ParameterNode>;
        
        while (node && !(op = this._getOperator(node, args))) {
            if (!node.next)
                return undefined;
            
            node = this._findNode(args[0], node.next);
        }

        return op;
    }

    private _findOperatorNode(arg: any): Some<ParameterNode> {        
        let node = this._findNode(arg);

        while (node && node.value.length === 0) {
            if (!node.next)
                break;

            node = this._findNode(arg, node.next);
        }

        return node?.value && node.value.length > 0 ? node : undefined;
    }
    
    private _findOptionalNode(): Some<ParameterNode> {
        let node = this._getNode(Parameter.empty);

        if (node && node.value.length > 0)
            return node;

        node = this._whereNode(p => p.isOptional);

        while (node && node.value.length === 0) {
            if (!node.next)
                break;

            node = this._whereNode(p => p.isOptional, node.next);
        }

        return node?.value && node.value.length > 0 ? node : undefined;
    }
    
    private _getNode(parameter: Parameter): Some<ParameterNode> {
        return this._whereNode(p => p.equals(parameter));
    }

    private _getOperator(node: ParameterNode, args: any[]): Some<ParameterNode> {
        const getOp = () => 
            node.key.acceptsAll(args)
                ? node?.value && node.value.length > 0 ? node : undefined
                : undefined;
        
        return node.children ? node.children._findOperator(args.slice(1)) || getOp() : getOp();
    }

    private _getDomain(domain: Parameter[]): Some<ParameterNode> {
        let operator: Some<OverloadedOperator> = this;
        let node: Some<ParameterNode>;

        for (let parameter of domain) {
            node = operator ? operator._getNode(parameter) : undefined;

            if (!node)
                return undefined;

            operator = node.children;
        }

        return node;
    }

    private _hasNode(args: any[]): boolean {
        return !!this._findOperator(args);
    }

    private _whereNode(predicate: (parameter: Parameter) => boolean, start: Some<ParameterNode> = undefined): Some<ParameterNode> {
        let node = start ?? this._head;

        while (node && !predicate(node.key))
            node = node.next;

        return node;
    }
}

export class Module {
    private readonly _operators: Map<string, OverloadedOperator>;

    constructor() {
        this._operators = new Map<string, OverloadedOperator>();
    }

    static from(operators: Mapping<(Operator | OverloadedOperator)>): Module {

        if (operators instanceof Map)
            return Module._fromMap(operators);

        return Module._fromObject(operators);
    }

    call(name: string, ...args: any[]): any {
        if (!this.supports(name, args))
            throw $err.Invalid(
                `Operation::.${this.call.name}[${name}]`,
                `No implementation for given args: (${$util.stringify(...args)})`);

        return this._operators.get(name)!.call(...args);
    }

    get(name: string): Some<OverloadedOperator> {
        return this._operators.get(name);
    }

    overload(name: string, ...ops: (OverloadedOperator | Operator)[]) {
        ops.forEach(op => this.set(name, op));
    }

    set(name: string, op: OverloadedOperator | Operator): void {
        if (!this._operators.has(name)) {
            this._operators.set(name, op instanceof OverloadedOperator ? op : new OverloadedOperator());

            if (op instanceof OverloadedOperator)
                return;
        }

        if (op instanceof Operator) {
            this._operators.get(name)!.add(op);
            return;
        }

        this._operators.get(name)!.overload(...op.operators());
    }

    supports(name: string, args: any[]): boolean {
        return this._operators.has(name) && this._operators.get(name)!.supports(args);
    }

    private static _fromMap(operators: Map<string, (Operator | OverloadedOperator)>): Module {
        const m = new Module();
        for (const [k, v] of operators.entries())
            m.set(k, v);

        return m;
    }

    private static _fromObject(operators: {[key: string]: (Operator | OverloadedOperator)}): Module {
        const m = new Module();
        for (const key of Object.keys(operators))
            m.set(key, operators[key]);

        return m;
    }
}

export class Package {
    [key: string]: any

    private readonly _modules: Map<string, Module>;

    constructor() {
        this._modules = new Map<string, Module>();
    }

    add(module: Module, label: string): void {
        if (this._modules.has(label))
            throw $err.DuplicateKey(label);

        this._modules.set(label, module);
        this[label] = module;
    }

    call(module: string, op: string, ...args: any[]): any {
        if (!(this._modules.has(module)))
            throw $err.Invalid("Module", `Module \`${module}\` does not exist.`);

        if(!this._modules.get(module)!.supports(op, args))
            throw $err.Invalid(
                `Operation :: .${this.call.name}[${!!module ? `${module}.` : ''}${op}]`,
                `No implementation for given args: [${$util.stringify(...args)}]`);

        try {
            return this._modules.get(module)!.call(op, ...args);
        } catch (e: any) {
            throw $err.Invalid(
                `Call :: ${!!module ? `${module}.` : ''}${op}[${$util.stringify(...args)}]`,
                e.mesage);
        }
    }

    callOp(op: string, ...args: any[]): any {
        for (const mod of Array.from(this._modules.values()).reverse())
            if (mod.supports(op,args))
                try {
                    return mod.call(op, ...args);
                } catch (e: any) {
                    throw $err.Invalid(
                        `Call :: ${op}[${$util.stringify(...args)}]`,
                        e.message ? `\nFrom: ${e.message}` : "");
                }


        throw $err.Invalid(
            `Operation::.${this.callOp.name}[${op}]`,
            `No implementation for given args: (${$util.stringify(...args)})`);
    }

    collect(func: string): Operator[] {
        return Array.from(this._modules.values())
            .map(mod => mod.get(func)?.operators() ?? [])
            .flat();
    }

    remove(module: string): void {
        if (this._modules.has(module)) {
            this._modules.delete(module);
            this[module] = undefined;
        }
    }
}

type ParameterNode = {
    children: Some<OverloadedOperator>,
    previous: Some<ParameterNode>,
    next: Some<ParameterNode>,
    key: Parameter
    value: Operator[]
}