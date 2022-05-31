import {Expression, MetaExpression} from "../../lang/expression";
import {$type, Trilean} from "../../common";
import {Module, op, Parameter} from "../../lang/operator";
import {Std} from "../Std";

export const Arithmetic = Module.from({
    add: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) + $type.number(Expression.build(n)),
        true),

    and: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) & $type.number(Expression.build(n)),
        true),

    ashr: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) >> $type.number(Expression.build(n))),

    div: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) / $type.number(Expression.build(n))),

    divc: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            Math.ceil($type.number(Expression.build(m)) / $type.number(Expression.build(n)))),

    divf: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            Math.floor($type.number(Expression.build(m)) / $type.number(Expression.build(n)))),

    divr: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            Math.round($type.number(Expression.build(m)) / $type.number(Expression.build(n)))),

    divx: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            Math.trunc($type.number(Expression.build(m)) / $type.number(Expression.build(n)))),

    even: op<Trilean>([[MetaExpression.name, "number"]],
        (m: MetaExpression | number) => Trilean.of(($type.number(Expression.build(m)) & 1) == 0)),

    idiv: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(n)) / $type.number(Expression.build(m))),

    inv: op<number>(["number"], (n: number): number => ~n),

    lshr: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) >>> $type.number(Expression.build(n))),

    mod: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) => {
            const [x, y] = [$type.number(Expression.build(m)), $type.number(Expression.build(n))];
            return x - (y * Math.floor(x / y));
        }),

    mul: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) * $type.number(Expression.build(n)),
        true),

    neg: op<number>(["number"], (n: number): number => -n),

    odd: op<Trilean>([[MetaExpression.name, "number"]],
        (m: MetaExpression | number) => Trilean.of(($type.number(Expression.build(m)) & 1) == 1)),

    or: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) | $type.number(Expression.build(n)),
        true),

    pmod: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) => {
            const [x, y] = [$type.number(Expression.build(m)), Math.abs($type.number(Expression.build(n)))];
            return x - y * Math.floor(x / y);
        }),

    pow: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m)) ** $type.number(Expression.build(n))),

    rem: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) => {
            const [x, y] = [$type.number(Expression.build(m)), $type.number(Expression.build(n))];
            return x - (y * Math.trunc(x / y));
        }),

    shl: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m))<< $type.number(Expression.build(n))),

    sub: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m))- $type.number(Expression.build(n))),

    xor: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (m: MetaExpression | number, n: MetaExpression | number) =>
            $type.number(Expression.build(m))^ $type.number(Expression.build(n)),
        true)
});

export const Numerics = Module.from({
    abs: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.abs($type.number(Expression.build(n)))),

    acos: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.acos($type.number(Expression.build(n)))),

    acosh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.acosh($type.number(Expression.build(n)))),

    asin: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.asin($type.number(Expression.build(n)))),

    asinh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.asinh($type.number(Expression.build(n)))),

    atan: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.atan($type.number(Expression.build(n)))),

    atan2: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (y: MetaExpression | number, x: MetaExpression | number) =>
            Math.atan2($type.number(Expression.build(y)), $type.number(Expression.build(x)))),

    atanh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.atanh($type.number(Expression.build(n)))),

    avg: op<number>([Parameter.variadic([MetaExpression.name, "number"])],
        (...args: (MetaExpression | number)[]) =>
            Std.call("Numerics", "sum", ...args) / args.length),

    clamp: op<number>(
        [[MetaExpression.name, "number"], [MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (n: MetaExpression | number, min: MetaExpression | number, max: MetaExpression | number) => {
            const [x, l, r] = [
                $type.number(Expression.build(n)),
                $type.number(Expression.build(min)),
                $type.number(Expression.build(max))];

            return x <= l ? l : x >= r ? r : x;
        }),

    cos: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.cos($type.number(Expression.build(n)))),

    cosh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.cosh($type.number(Expression.build(n)))),

    ceil: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.ceil($type.number(Expression.build(n)))),

    fix: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.trunc($type.number(Expression.build(n)))),

    floor: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.floor($type.number(Expression.build(n)))),

    ln: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.log($type.number(Expression.build(n)))),

    log: op<number>([[MetaExpression.name, "number"], [MetaExpression.name, "number"]],
        (x: MetaExpression | number, y: MetaExpression | number) =>
            Math.log($type.number(Expression.build(x)) / Math.log($type.number(Expression.build(y))))),

    log2: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.log2($type.number(Expression.build(n)))),

    log10: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.log10($type.number(Expression.build(n)))),

    max: op<number>([Parameter.variadic([MetaExpression.name, "number"])],
        (...args: (MetaExpression | number)[]) => Math.max(
            ...args.map(arg => $type.number(Expression.build(arg)))),
        true),

    min: op<number>([Parameter.variadic([MetaExpression.name, "number"])],
        (...args: (MetaExpression | number)[]) => Math.min(
            ...args.map(arg => $type.number(Expression.build(arg)))),
        true),

    random: op<number>([], (): number => Math.random()),

    round: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.round($type.number(Expression.build(n)))),

    sgn: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.sign($type.number(Expression.build(n)))),

    sin: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.sin($type.number(Expression.build(n)))),

    sinh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.sinh($type.number(Expression.build(n)))),

    sqrt: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.sqrt($type.number(Expression.build(n)))),

    sum: op<number>([Parameter.variadic([MetaExpression.name, "number"])],
        (...args: (MetaExpression | number)[]) =>
            args.map(arg => $type.number(Expression.build(arg))).reduce((x, y) => x + y),
        true),

    tan: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.tan($type.number(Expression.build(n)))),

    tanh: op<number>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number): number => Math.tanh($type.number(Expression.build(n))))
});
