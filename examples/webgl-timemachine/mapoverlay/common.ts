import type {NamedType, ParameterType, Some, TypeCheckerFunction, UnitOrArray} from "./types";
import {TypeChecker} from "./types";

export module $err {
    export const DuplicateKey = (key: any): Error => new Error(`Duplicate key: ${key}`);
    export const Invalid = (name: string, invalid: any): Error => new Error(`Invalid ${name}: ${invalid}`);
    export const TypeError = (expected: string, received: string) => new Error(`Type Error: {expected: ${expected}, received: ${received}}`);

    export const throw_ = (error: Error) => { throw error; };
}

export module $iter {
    export function copy<T = any>(iter: Iterable<T>): T[] {
        return Array.from(iter).map(_ => _);
    }

    export function equal<T>(
        iter1: Iterable<T>,
        iter2: Iterable<T>,
        cmp: Some<(x: T, y: T) => boolean> = undefined) {
        const [arr1, arr2] = [Array.from(iter1), Array.from(iter2)];
        cmp ??= ((x, y) => x === y);

        return arr1.length === arr2.length && arr1.every((e, i) => cmp!(e, arr2[i]));
    }

    export function fill<T = any>(e: T, n: number): T[] {
        return range(n).map(_ => e);
    }

    export function has<T>(iter: Iterable<T>, value: T): boolean {
        return Array.from(iter).some(e => e === value);
    }

    export function isEmpty<T>(iter: Iterable<T>): boolean {
        return (Array.isArray(iter) ? iter.length : Array.from(iter).length) === 0
    }

    export function last<T>(iter: Iterable<T>): Some<T> {
        const arr = Array.from(iter);
        return arr.length === 0 ? undefined : arr[arr.length - 1];
    }

    export function padding<T = any>(length: number, fill: T): T[] {
        if (length <= 0)
            return [];

        return range(length).map(_ => fill);
    }

    export function range(s: number, e: Some<number> = undefined, d: number = 1): number[] {
        d = Math.abs(d);
        const [start, end] = e ? [s, e] : [0, s];
        const n = Math.ceil((end - start) / d);
        d = Math.sign(end - start) * d;

        return Array.from({length: n}, (_, i) => start + (d * i));
    }

    export function similar<T>(iter1: Iterable<T>, iter2: Iterable<T>) {
        const [arr1, arr2] = [Array.from(iter1), Array.from(iter2)];
        return arr1.length === arr2.length && arr1.every(e => $iter.has(arr2, e));
    }

    export function zip<T, U=T>(itert: Iterable<T>, iteru: Iterable<U>): [Some<T>, Some<U>][] {
        let [arrt, arru] = [Array.from(itert), Array.from(iteru)];
        let [lent, lenu] = [arrt.length, arru.length];

        if (lenu > lent)
            return arru.map<[Some<T>, U]>((u, i) => [lent <= i ? undefined : arrt[i], u]);

        return arrt.map<[T, Some<U>]>((t, i) => [t, lenu <= i ? undefined : arru[i]]);
    }
}

export module $test {
    export const MExpression = `:[[
        ["Number", 5],
        ["Trilean", [true, false, nil]],
        ["String", ["Double-quotes", 'Single-quotes']],
        ["Number Vector", [0, 1, 2, 3, 4, 5, 6]],
        ["Mixed Type Vector", [0, "string", true, [0, 1, 2, 3]]],
        ["Single Item Vector", [1,]],
        ["Record", :[[
            ["x", 0], 
            ["y", 1], 
            ["z", 2]]]],
        ["Map", .[x; x ^ 2] =>> [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]],
        ["Filter", .[x; x & 1 == 1] =<= [1, 4, 9, 16, 25, 36, 49, 64, 81]],
        ["Fold", add =<< [1, 9, 25, 49, 81]],
        ["Connected", add =<< odd =<= .[x; x ^ 2] =>> range[10]],
        ["Composition", foldl[add];filter[odd];map[.[x;x^2], range[10]]],
        ["Nil Coalescence (cull)", [nil ?? true]],
        ["Not True Coalescence (quell)", [[nil || false] ?! true]],
        ["If", ?:[false, "true", "false", "nil"]],
        ["Basic Math & Logic", :[[
            ["Exponentiation", [2^5]],
            ["Multiplication", [8 * 3]],
            ["Division", [22 / 7]],
            ["Ceiled Division", [22 +/ 7]],
            ["Floored Division", [22 -/ 7]],
            ["Inverse Division", [7 \\ 22]],
            ["Remainder", [22 // 7]],
            ["Modulo", [22 % 7]],
            ["Addition", [1 + 1]],
            ["Subtraction", [1 - 1]],
            ["Arithmetic Shift Right", [-8 >> 1]],
            ["Logical Shift Right", [-8 >>> 1]],
            ["Shift Left", [2147483644 << 1]],
            ["Bitwise And", [14 & 7]],
            ["Bitwise Xor", [12 ? 10]],
            ["Bitwise Or", [2 | 4]],
            ["Comparison", [-1 < 0, 0 <= 1, 2 > 1, 3 >= 2, 3 <> 4, 4 == 4]],
            ["Chained Comparison", [-1 < 0 < 1]],
            ["Equality", :[[
                ["Number", [0 == 0, 0 == 1, 0 <> 0, 0 <> 1]],
                ["Trilean", [true == true, true == false, true <> true, true <> false]],
                ["String", ["string" == "string", "string" == "string ", "string" <> "string", "string" <> "string "]],
                ["Vector", [[0, true, "string"] == [0, true, "string"], [0, true, "string"] <> [0, "string", true]]]]]],
            ["Logical And", true && false],
            ["Logical Implication", true -> false],
            ["Material Equivalence", nil <-> nil],
            ["Logical Or", false || nil]]]]
    ]]`

    export const Source = {
        Allegheny: {
            Population: {
                Total: 1218380,
                Female: 629258,
                Male: 589122,
                White: 0.79,
                Black: 0.13,
                Other: 0.08,
                MedianAge: 40.8
            }
        },
        Adams: {
            Population: {
                Total: 102627,
                Female: 52155,
                Male: 50472,
                White: 0.928,
                Black: 0.016,
                Other: 0.056,
                MedianAge: 44.8
            }
        },
        Armstrong: {
            Population: {
                Total: 65536,
                Female: 32929,
                Male: 32427,
                White: 0.973,
                Black: 0.009,
                Other: 0.018,
                MedianAge: 47
            }
        }
    };

    export const Target = `{
        "General 1": {
            ["Allegheny", "Allegheny County"],
            ["Adams", "Adams County"],
            ["Armstrong", "Armstrong County"]
        },
        "General 2": record(.(k;[cat(k, " County"), $(k)]) =>> fields($)),
        "Race": {
            "Black": {
                "Allegheny County": $("Allegheny", "Population", "Black") * $("Allegheny", "Population", "Total"),
                "Adams County": $("Adams", "Population", "Black") * $("Adams", "Population", "Total"),
                "Armstrong County": $("Armstrong", "Population", "Black") * $("Armstrong", "Population", "Total")
            },
            "White": {
                "Allegheny County": $("Allegheny", "Population", "White") * $("Allegheny", "Population", "Total"),
                "Adams County": $("Adams", "Population", "White") * $("Adams", "Population", "Total"),
                "Armstrong County": $("Armstrong", "Population", "White") * $("Armstrong", "Population", "Total")
            },
            "Other": {
                "Allegheny County": $("Allegheny", "Population", "Other") * $("Allegheny", "Population", "Total"),
                "Adams County": $("Adams", "Population", "Other") * $("Adams", "Population", "Total"),
                "Armstrong County": $("Armstrong", "Population", "Other") * $("Armstrong", "Population", "Total")
            }
        },
        "Sex": {
            "Female": {
                "Allegheny County": $("Allegheny", "Population", "Female") * $("Allegheny", "Population", "Total"),
                "Adams County": $("Adams", "Population", "Female") * $("Adams", "Population", "Total"),
                "Armstrong County": $("Armstrong", "Population", "Female") * $("Armstrong", "Population", "Total")
            },
            "Male": :(.(k;[k * " County", mul =<< .(n; $(k, "Population", n)) =>> ["Male", "Total"]]) =>> fields($))
        }
    }`
}

export module $type {
    export function allNumbers(objects: any[]): boolean {
        return sameType(objects, "number");
    }

    export function check<T = any>(obj: any, type: string): T {
        return isKindOf(obj, type)
            ? obj as T
            : $err.throw_($err.TypeError(type, kindOf(obj)));
    }

    export function isKindOf(object: any, type: string) {
        return $util.capitalize(type) === $util.capitalize(kindOf(object))
    }

    export function isKindOfOne(object: any, types: string[]): boolean {
        return types.some(type => isKindOf(object, type));
    }

    export function isOf(object: any, type: string) {
        return $iter.has(lineageOf(object), $util.capitalize(type));
    }

    export function isOfOne(object: any, types: string[]) {
        const lineage = lineageOf(object);
        return types.some(type => $iter.has(lineage, $util.capitalize(type)));
    }

    export function isPrimitive(object: any): boolean {
        return typeof object === "string"
            || typeof object === "number"
            || isKindOf(object, Trilean.name);
    }

    export function kindOf (object: any) : string {
        return typeof object === "object" ? object.constructor.name : typeof object;
    }

    export function lineageOf(object: any): string[] {
        const ancestry = (obj: any, ctors: Set<string>) => {
            if (obj == undefined)
                return;

            const prototype = Object.getPrototypeOf(obj);

            if (!ctors.has(prototype)) {
                ctors.add(prototype);
                ancestry(prototype, ctors);
            }
        }

        const ctors = new Set<string>();
        ancestry(object, ctors);
        return Array.from(ctors)
            .filter(ctor => !!ctor)
            .map(ctor => ctor.constructor.name);
    }

    export function normalizeType(type: ParameterType): ParameterType<string> {
        const normalizeNamedType = (named: UnitOrArray<NamedType>): UnitOrArray<string> =>
        {
            if (!Array.isArray(named))
                return typeof named === "string" ? named : named.name;

            return named.map(t => typeof t === "string" ? t : t.name);
        }

        if (typeof type === "string")
            return type;

        if ("type" in type)
            return {...type, "type": normalizeNamedType(type["type"])};

        if (!Array.isArray(type))
            return type.name;

        return type.map(t => normalizeType(t) as string);
    }

    export function number(obj: any): number {
        return check<number>(obj, "number");
    }

    export function sameType(objects: any[], type: string) {
        return objects.every(obj => isKindOf(obj, type));
    }

    export function string(obj: any): string {
        return check<string>(obj, "string");
    }

    export function trilean(obj: any): Trilean {
        return check<Trilean>(obj, Trilean.name);
    }
}

export module $util {
    export const capitalize = (str: string): string =>
        str.length === 0 ? "" : str.length === 1
            ? str.toUpperCase()
            : `${str.charAt(0).toUpperCase()}${str.substring(1)}`;

    export const check = (obj: any): boolean => obj != undefined;

    export const exceeds = (n: number, input: number | string | Array<any>): boolean => {
        const l = Array.isArray(input) || typeof input === "string" ? input.length : input;

        return -l > n && n >= l;
    }

    export const getTypeChecker = (lenient: boolean = true): TypeCheckerFunction => {
        return lenient ? TypeChecker.Accepts : TypeChecker.Takes;
    }

    export const isValidMarker = (marker: string): boolean => /^@?[a-zA-Z_][a-zA-Z0-9_]*$/.test(marker);

    export const stringify = (...args: any[]): string =>
        args.length === 0 ? "" : args.map(arg => arg.toString()).join(", ");
}

export class Ideograph {
    private readonly _input: string;

    private _index: number;

    constructor(input: string) {
        this._input = input;
        this._index = 0;
    }

    static squeeze(input: string): [string, Map<number, {line: number, index: number}>] {
        if (input.trim().length === 0)
            return ["", new Map<number, {line: number, index: number}>()];

        const ig = new Ideograph(input);
        const isEscaped = (input: string, i: number) => input[i - 1] === "\\";

        let tokens = [];
        let tokenMap = new Map<number, {line: number, index: number}>();
        let offset = 0;
        let line = 1;
        let lb = false;
        let stringctx = "";
        let lineIndex = 0;

        while (ig.hasCharacters) {
            let n = ig.next();

            if (/\n/.test(n) || lb) {
                line++;
                lb = false;
                lineIndex = 0;
            }

            if (/\r/.test(n))
                lb = true;

            if (/\s+/.test(n) && !stringctx) {
                offset++;
                continue;
            }

            tokenMap.set(ig.index - offset, {line: line, index: lineIndex++})
            tokens.push(n);

            if (n === '"' || n === "'")
                stringctx = !stringctx
                    ? n
                    : stringctx !== n
                        ? stringctx
                        : isEscaped(input, ig.index - 1) ? stringctx : "";
        }

        return [tokens.join(''), tokenMap];
    }

    get current(): string {
        return this._input[this._index];
    }

    get hasCharacters(): boolean {
        return this._index < this._input.length;
    }

    get index(): number {
        return this._index;
    }

    next(k: number = 1): string {
        let token = "\0";

        if (!this.hasCharacters)
            return token;

        if (k === 0)
            return this.current;

        k = Math.min(this._input.length - this._index, k);
        token = this._input.substring(this._index, this._index + k);
        this._index += k;
        return token;
    }
}

export class Trilean {
    private static _False: Trilean;
    private static _Nil: Trilean;
    private static _True: Trilean;

    private readonly _code: number;

    private constructor(value: Some<number | boolean>) {
        this._code = value == undefined
            ? 0
            : typeof value === "number"
                ? Math.sign(value)
                : value ? 1: -1;
    }

    static of(value: Some<number | boolean>): Trilean {
        return value == undefined
            ? Trilean.Nil
            : typeof value === "number"
                ? value < 0 ? Trilean.False : value > 0 ? Trilean.True : Trilean.Nil
                : value ? Trilean.True : Trilean.False;
    }

    static get False(): Trilean {
        if (!Trilean._False)
            Trilean._False = new Trilean(-1);

        return Trilean._False;
    }

    static get Nil(): Trilean {
        if (!Trilean._Nil)
            Trilean._Nil = new Trilean(0);

        return Trilean._Nil;
    }

    static get True(): Trilean {
        if (!Trilean._True)
            Trilean._True = new Trilean(1);

        return Trilean._True;
    }

    get isFalse(): boolean {
        return this._code === -1;
    }

    get isNil(): boolean {
        return this._code === 0;
    }

    get isTrue(): boolean {
        return this._code === 1;
    }

    and = (q: Trilean): Trilean => Trilean.of(Math.min(this._code, q._code));

    compare = (q: Trilean): Trilean =>Trilean.of(this._code - q._code);

    i = (): Trilean => Trilean.of(this.isNil);

    if = (t: any, f: any = undefined, n: any = undefined): any =>this._code > 0 ? t : this._code < 0 ? f : n;

    iff = (q: Trilean): Trilean => Trilean.of(1 - Math.abs(this._code - q._code));

    implies = (q: Trilean): Trilean => Trilean.of(Math.min(1, 1-this._code+q._code));

    l = (): Trilean => Trilean.of(this.isTrue);

    m = (): Trilean => Trilean.of(!this.isFalse);

    not = (): Trilean => Trilean.of(-this._code);

    or = (q: Trilean): Trilean => Trilean.of(Math.max(this._code, q._code));

    snorm = (q: Trilean): Trilean => Trilean.of(Math.min(1, this._code + q._code + 1));

    tnorm = (q: Trilean): Trilean => Trilean.of(Math.max(-1, this._code + q._code - 1));

    toString = (): string => this._code < 0 ? "false" : this._code > 0 ? "true" : "nil";
}