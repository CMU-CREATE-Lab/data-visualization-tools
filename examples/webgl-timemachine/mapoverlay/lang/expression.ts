import {$err, $iter, $type, $util, Trilean} from "../common";
import {Class, Some} from "../types";
import {Std} from "../lib/Std";

export type MExpression = number | string | Trilean | MetaExpression;

export class Expression {
    static str(expr: MExpression): string {
        if (typeof expr === "number" || $type.kindOf(expr) === "Trilean")
            return expr.toString();

        if (typeof expr === "string")
            return `"${expr}"`;

        return (<MetaExpression>expr).str();
    }

    static text(expr: MExpression): string {
        if (typeof expr === "number" || $type.kindOf(expr) === "Trilean")
            return expr.toString();

        if (typeof expr === "string")
            return `"${expr}"`;

        return (<MetaExpression>expr).text();
    }

    static build(expr: MExpression, ...args: MExpression[]): MExpression {
        if (typeof expr === "string" || typeof expr === "number")
            return expr;

        if($type.kindOf(expr) === "Trilean")
            return <Trilean>expr;

        return (<MetaExpression>expr).build(...args);
    }

    static match(expr: MExpression, names: Map<string, MExpression>): MExpression {
        if (typeof expr === "string" || typeof expr === "number" || expr instanceof Trilean)
            return expr;

        if (expr instanceof Marker)
            return names.get(expr.marker) ?? expr;


        if (expr instanceof Record)
            return new Record(Object.fromEntries(
                Object.entries(expr.object)
                    .map(([f, v]) => [f, Expression.match(v, names)])));

        if (expr instanceof Vector)
            return new Vector(expr.expressions.map(x => Expression.match(x, names)));

        return (<Evaluation | Lambda>expr).match(names);
    }
}

export abstract class MetaExpression {
    static as<M extends MetaExpression>(mexpr: MetaExpression, type: Class<M> | string) {
        type = typeof type === "string" ? type : type.name;

        if (!MetaExpression.is(mexpr, type))
            throw $err.Invalid(
                "Cast",
                `MetaExpression of type ${$type.kindOf(mexpr)} cannot be cast to expression of type ${type}.`);

        return (mexpr as unknown) as M;
    }

    static is<M extends MetaExpression>(mexpr: MetaExpression, type: Class<M> | string) {
        return $type.kindOf(mexpr) === (typeof type === "string" ? type : type.name);
    }

    toString(): string {
        return this.str();
    }

    build(..._:MExpression[]): MExpression {
        return this;
    }

    abstract str(): string;

    abstract text(): string;
}

export class Marker extends MetaExpression {
    private static readonly _Functions: Map<string, Marker> = new Map<string, Marker>();
    private static readonly _Operators: Map<string, Marker> = new Map<string, Marker>([
        [':', Marker.for("record")],
        ["??", Marker.for("cull")],
        ["?!", Marker.for("quell")],
        ["?:", Marker.for("if")],
        ['=>>', Marker.for("map")],
        ['=<=', Marker.for("filter")],
        ['=<<', Marker.for("foldl")],
        ["||", Marker.for("or")],
        ["->", Marker.for("imp")],
        ["<->", Marker.for("iff")],
        ["&&", Marker.for("and")],
        ["<>", Marker.for("ne")],
        ["==", Marker.for("eq")],
        ["<=>", Marker.for("cmp")],
        [">=", Marker.for("ge")],
        ['>', Marker.for("gt")],
        ["<=", Marker.for("le")],
        ['<', Marker.for("lt")],
        ['|', Marker.for("or")],
        ['&', Marker.for("and")],
        ['?', Marker.for("xor")],
        ["<<", Marker.for("shl")],
        [">>",  Marker.for("ashr")],
        [">>>", Marker.for("lshr")],
        ['+', Marker.for("add")],
        ['-', Marker.for("sub")],
        ['*', Marker.for("mul")],
        ["/", Marker.for("div")],
        ['%', Marker.for("mod")],
        ['\\', Marker.for("idiv")],
        ["//", Marker.for("rem")],
        ["+/", Marker.for("divc")],
        ["-/", Marker.for("divf")],
        ['^', Marker.for("pow")],
        ["u-", Marker.for("neg")],
        ['~', Marker.for("inv")],
        ['private _', Marker.for("len")]
    ]);

    private readonly _marker: string;

    private constructor(marker: string) {
        super();
        this._marker = marker;
    }

    static for(marker: string | Marker): Marker {
        if (typeof marker !== "string")
            return marker;

        if (marker === "u-" || !/@?[a-zA-Z0-9_]+/.test(marker)) {
            if (!Marker._Operators.has(marker))
                throw $err.Invalid("Operator", marker);

            return Marker._Operators.get(marker)!;
        }

        if (!$util.isValidMarker(marker))
            throw $err.Invalid("Symbol", marker);

        if (!Marker._Functions.has(marker))
            Marker._Functions.set(marker, new Marker(marker));

        return Marker._Functions.get(marker)!;
    }

    get marker(): string {
        return this._marker;
    }

    equals(marker: string | Marker) {
        return this._marker === (typeof marker === "string" ? marker : marker._marker);
    }

    str(): string {
        return this._marker;
    }

    text(): string {
        return `<Marker :: ${this._marker}>`;
    }
}

export class Vector extends MetaExpression {
    private readonly _exprs: MExpression[];

    constructor(exprs: Some<Iterable<MExpression>> = undefined) {
        super();
        this._exprs = exprs ? $iter.copy(exprs) : [];
    }

    static contain(expr: MExpression): Vector {
        return new Vector([expr]);
    }

    get expressions(): MExpression[] {
        return this._exprs;
    }

    get length(): number {
        return this._exprs.length;
    }

    [Symbol.iterator]() {
        let expr = this._exprs.length === 0 ? undefined : this._exprs[0];
        let i = 0;
        let that = this;

        return {
            next() {
                if (expr) {
                    let res = {done: false, value: expr};
                    expr = that._exprs[i++];
                    return res;
                }

                return {done: true, value: undefined};
            }
        }
    }

    build(): MExpression {
        return new Vector(this._exprs.map(_ => Expression.build(_)));
    }

    str(): string {
        return this._getString(false);
    }

    text(): string {
        return `<Vector :: ${this._getString()}>`;
    }

    private _getString(typed: boolean = true) {
        const f = typed ? "text" : "str";
        const exprs = this._exprs.map(_ => Expression[f](_));
        return `[${exprs.length === 1 ? `${exprs[0]},` : exprs.join(',')}]`
    }
}

export class Evaluation extends MetaExpression {
    private readonly _marker: Marker;
    private readonly _arguments: MExpression[];

    private _eager: boolean;

    constructor(
        marker: Some<Marker> = undefined,
        eager: boolean = false,
        ...args: MExpression[]) {

        super();
        [this._marker, this._eager, this._arguments] = [
            marker ?? Marker.for("nop"),
            eager,
            args ?? []];
    }

    get isEager() {
        return this._eager;
    }

    set isEager(eager: boolean) {
        this._eager = eager;
    }

    curry(...args: MExpression[]): Evaluation {
        if (args.length > 0)
            return new Evaluation(this._marker, this._eager, ...this._arguments, ...args);

        return this;
    }

    match(parameters: Map<string, MExpression>): Evaluation {
        const args = this._arguments.map(arg => {
            return arg instanceof Marker
                ? parameters.has(arg.marker)
                    ? parameters.get(arg.marker)!
                    : arg
                : Expression.match(arg, parameters);
        });

        return new Evaluation(this._marker, this._eager, ...args);
    }

    build(...args: MExpression[]): MExpression {
        args = this._arguments.concat(args);
        const f = Math.min(...Std.collect(this._marker.marker).map(op => op.signature.arity));

        if (args.length < f)
            return this.curry(...args.slice(this._arguments.length));

        if (this._eager)
            args = args.map(_ => Expression.build(_));

        return Std.callOp(this._marker.marker, ...args);
    }

    str(): string {
        const args = this._arguments.map(x => Expression.str(x)).join(',');
        return `${this._eager ? '!' : ''}${this._marker.str()}[${args}]`;
    }
    text(): string {
        return `<Evaluation :: ${this.str()}>`;
    }
}

export class Lambda extends MetaExpression {
    private readonly _parameters: Marker[];
    private readonly _body: MExpression;
    private readonly _arguments: MExpression[];
    private readonly _variadic: boolean;

    private _eager: boolean;

    constructor(
        parameters: Some<Iterable<Marker>>,
        body: MExpression,
        variadic: boolean = false,
        eager: boolean = false,
        ...args: MExpression[]) {

        super();
        this._parameters = parameters ? $iter.copy(parameters) : [];
        this._body = body;
        [this._variadic, this._eager] = [variadic, eager];
        this._arguments = args;
    }

    get arity(): number {
        return this._parameters.length === 0
            ? 0
            : this._variadic
                ? this._parameters.slice(0, this._parameters.length - 1).length
                : this._parameters.length;
    }

    get isEager() {
        return this._eager;
    }

    set isEager(eager: boolean) {
        this._eager = eager;
    }

    get rank(): number {
        return this.arity - this._arguments.length;
    }

    match(parameters: Map<string, MExpression>): Lambda {
        const markers = new Set(this._parameters.map(p => p.marker));
        const names = new Map<string, MExpression>(
            Array.from(parameters.entries()).filter(([k, _]) => !markers.has(k)));

        return new Lambda(
            this._parameters,
            Expression.match(this._body, names),
            this._variadic,
            this._eager,
            ...this._arguments);
    }

    curry(...args: MExpression[]): Lambda {
        if (args.length > 0)
            return new Lambda(this._parameters, this._body, this._variadic, this._eager, ...this._arguments, ...args);

        return this;
    }

    build(...args: MExpression[]): MExpression {
        args = this._setupArguments(...args);

        if (this.rank > args.length)
            return this.curry(...args);

        if (args.length === 0)
            return Expression.build(this._body);

        const [parameters, variadic] = [this._parameters, this._variadic];

        let namedParameters =
            this._parameters.length === 1
                ? new Map<string, MExpression>([
                    [parameters[0].marker, variadic ? new Vector(args) : args[0]]])
                : new Map<string, MExpression>(
                    <[string, MExpression][]>$iter.zip(
                       parameters.slice(0, this.arity).map(p => p.marker),
                        args.slice(0, this.arity)));

        if (variadic)
            namedParameters.set($iter.last(parameters)!.marker, new Vector(args.slice(parameters.length - 1)));

        const body = Expression.match(this._body, namedParameters);

        if (!(body instanceof Evaluation))
            return Expression.build(body, ...args);

        return body.build();
    }

    str(): string {
        const args = this._arguments.map(arg => Expression.text(arg)).join(',');
        const parameters = this._parameters.map(p => p.str()).join(',');
        const body = Expression.str(this._body);

        return `${this._eager ? '!' : ''}.[[${parameters}];${body}${args.length > 0 ? `;[${args}]` : ''}]`;
    }

    text(): string {
        return `<Lambda :: ${this.str()}>`;
    }

    private _setupArguments(...args: MExpression[]): MExpression[] {
        if((this._arguments.length > this.arity) && !this._variadic)
            throw $err.Invalid(
                "Number of Arguments",
                `{expected: ${this.arity}, received: ${this._arguments.length}}`);

        if((args.length > this.rank) && !this._variadic)
            throw $err.Invalid(
                "Number of Arguments",
                `{expected: ${this.rank}, received: ${args.length}}`);

        if (this.rank > args.length)
            return args;

        args = this._arguments.concat(args);

        return args.length === 0 || !this._eager
            ? args
            : args.map(arg => Expression.build(arg));
    }
}

export class Record extends MetaExpression {
    private readonly _record: {[key: string]: MExpression};

    constructor(obj: Some<{[key: string]: MExpression}> = undefined) {
        super();
        this._record = obj ? {...obj} : {};
    }

    static fromIterable(record: Iterable<[string, MExpression]>): Record {
        return new Record(Object.fromEntries(record));
    }

    get object(): {[key: string]: MExpression} {
        return this._record;
    }

    build(): MExpression {
        return new Record(
            Object.fromEntries(Object.entries(this._record)
                .map(([k, v]) => [k, Expression.build(v)])));
    }

    str(): string {
        const obj = Object.entries(this._record)
            .map(pair => `${pair[0]}: ${Expression.str(pair[1])}`)
            .join(',');
        return `{${obj}}`;
    }

    text(): string {
        return `<Record :: ${this.str()}>`;
    }
}