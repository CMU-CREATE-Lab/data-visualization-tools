import {Module, op, Parameter} from "../../lang/operator";
import {
    Evaluation,
    Expression,
    Lambda,
    Marker,
    MetaExpression,
    MExpression,
    Record,
    Vector
} from "../../lang/expression";
import {$err, $type, Trilean} from "../../common";
import {ExpressionTypes} from "./common";
import {Std} from "../Std";
import {Some} from "../../types";

export const Logic = Module.from({
    and: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .and($type.trilean(Expression.build(n))),
        true),

    cmp: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) => {
            [x, y] = [Expression.build(x), Expression.build(y)]
            const [tx, ty] = [$type.kindOf(x), $type.kindOf(y)];

            if (tx !== ty)
                throw $err.TypeError("Expressions of same type", `(${tx}, ${ty})`);

            if (!$type.isPrimitive(x))
                throw $err.TypeError("Expected primitive expressions", `(${tx}, ${ty})`);

            if ($type.kindOf(x) === Trilean.name)
                return (<Trilean>x).compare(<Trilean>y);

            if (typeof x === "string")
                return x < (y as string) ? Trilean.False : x > (y as string) ? Trilean.True : Trilean.Nil;

            return Trilean.of((x as number) - (y as number));
        }),

    cull: op<MExpression>([ExpressionTypes, ExpressionTypes],
        (m: MExpression, alt: MExpression) => m instanceof Trilean && m.isNil ? alt : m),

    eq: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) => {
            [x, y] = [Expression.build(x), Expression.build(y)];
            const [tx, ty] = [$type.kindOf(x), $type.kindOf(y)];

            if (tx !== ty)
                return Trilean.False;

            switch (ty) {
                case Marker.name:
                    return Trilean.of((x as Marker).marker === (y as Marker).marker);
                case Trilean.name:
                    return (<Trilean>x).iff((<Trilean>y));
                case Vector.name:
                    const [exprs1, exprs2] = [(x as Vector).expressions, (y as Vector).expressions];
                    return Trilean.of(
                        exprs1.length === exprs2.length
                        && exprs1.every(
                            (x, i) => 
                                (<Trilean>Std.call("Logic","eq", x, exprs2[i])).isTrue));
                default:
                    return Trilean.of(x === y);
            }
        },
        true),

    ge: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) => {
            const [tx, ty] = [$type.kindOf(x), $type.kindOf(y)];

            if (tx !== ty)
                return Trilean.Nil;

            switch (tx) {
                case Trilean.name:
                    return (<Trilean>x).compare(<Trilean>y).m();
                case "number":
                case "string":
                    return Trilean.of((x as (number | string)) >= (y as (number | string)));
                default:
                    return Trilean.Nil;
            }
        }),

    gt: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) => {
            const [tx, ty] = [$type.kindOf(x), $type.kindOf(y)];

            if (tx !== ty)
                return Trilean.Nil;

            switch (tx) {
                case Trilean.name:
                    return (<Trilean>x).compare(<Trilean>y).l();
                case "number":
                case "string":
                    return Trilean.of((x as (number | string)) > (y as (number | string)));
                default:
                    return Trilean.Nil;
            }
        }),

    I: op<Trilean>([[MetaExpression.name, Trilean.name]], (t: MetaExpression | Trilean) =>
        $type.trilean(Expression.build(t)).i()),

    if: op<MExpression>(
        [
            ExpressionTypes,
            Parameter.optional(ExpressionTypes),
            Parameter.optional(ExpressionTypes),
            Parameter.optional(ExpressionTypes)],
        (c: MExpression, t: MExpression, f: Some<MExpression> = undefined, n: Some<MExpression> = undefined) => {
            const mxpr = Expression.build(c);
            let val: Trilean;

            switch (typeof mxpr) {
                case "string":
                    val = Trilean.of(mxpr.length > 0);
                    break;
                case "number":
                    val = Trilean.of(mxpr);
                    break;
                default:
                    val = mxpr instanceof Evaluation || mxpr instanceof Lambda
                        ? Trilean.True
                        : mxpr instanceof Record
                            ? Trilean.of(Object.keys(mxpr.object).length > 0)
                            : mxpr instanceof Vector
                                ? Trilean.of(mxpr.expressions.length > 0)
                                : <Trilean>mxpr;
            }

            if (t == undefined && f == undefined && n == undefined)
                return val;

            return val.if(t, f ?? Trilean.Nil, n ?? Trilean.Nil);
        }),

    iff: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .iff($type.trilean(Expression.build(n))),
        true),

    imp: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .implies($type.trilean(Expression.build(n)))),

    L: op<Trilean>([[MetaExpression.name, Trilean.name]], (t: MetaExpression | Trilean) =>
        $type.trilean(Expression.build(t)).l()),

    le: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) =>
            Std.call("Logic", "not", Std.call("Logic", "gt", x, y))),

    lt: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) =>
            Std.call("Logic", "not", Std.call("Logic", "ge", x, y))),

    M: op<Trilean>([[MetaExpression.name, Trilean.name]], (t: MetaExpression | Trilean) =>
        $type.trilean(Expression.build(t)).m()),

    ne: op<Trilean>([ExpressionTypes, ExpressionTypes],
        (x: MExpression, y: MExpression) =>
            Std.call("Logic", "not", Std.call("Logic", "eq", x, y)),
        true),

    nop: op<Trilean>([Parameter.variadic(ExpressionTypes)],
        (..._: MExpression[]) => Trilean.Nil, true),

    not: op<Trilean>([[MetaExpression.name, Trilean.name]], (t: MExpression) =>
        $type.trilean(Expression.build(t)).not()),

    onlyif: op<MExpression>([[Evaluation.name, Lambda.name, Marker.name], ExpressionTypes, ExpressionTypes],
        (p: Evaluation | Lambda | Marker, val: MExpression, alt: MExpression) => {
            let res = $type.kindOf(p) === Marker.name
                ? Std.callOp((<Marker>p).marker, val)
                : $type.kindOf(p) === Evaluation.name
                    ? p.build()
                    : p.build(val);

            return $type.trilean(res).isTrue ? val : alt;
        }),

    or: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .or($type.trilean(Expression.build(n))),
        true),

    quell: op<MExpression>([ExpressionTypes, ExpressionTypes],
        (m: MExpression, alt: MExpression) => {
            if (m instanceof Trilean)
                return m.isTrue ? m : alt;

            if (typeof m === "number")
                return m !== 0 ? m : alt;

            if (typeof m === "string" || m instanceof Vector)
                return m.length > 0 ? m : alt;

            return m;
        }),

    snorm: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .snorm($type.trilean(Expression.build(n))),
        true),

    tnorm: op<Trilean>([[MetaExpression.name, Trilean.name], [MetaExpression.name, Trilean.name]],
        (m: MetaExpression | Trilean, n: MetaExpression | Trilean) =>
            $type.trilean(Expression.build(m))
                .tnorm($type.trilean(Expression.build(n))),
        true)
});