import {Module, op, Parameter} from "../../lang/operator";
import {Expression, MetaExpression, MExpression, Vector} from "../../lang/expression";
import {ExpressionTypes} from "./common";
import {$err, $iter, $type, $util, Trilean} from "../../common";
import {Std} from "../Std";
import {Some} from "../../types";

const vector = (obj: any) => $type.check<Vector>(obj, Vector.name);

export const Vectors = Module.from({
    chain: op<Vector>([Parameter.variadic(MetaExpression.name)],
        (...args: MetaExpression[]) => new Vector(
            args.map(arg => vector(arg)).flat())),

    endsWith: op<Trilean>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: MExpression) => {
            const vec = vector(v);
            return vec.length === 0
                ? Trilean.False
                : Std.call("Logic","eq", $iter.last(vec.expressions), Expression.build(m));
        }),

    fill: op<Vector>([ExpressionTypes, [MetaExpression.name, "number"]],
        (e: MExpression, c: MetaExpression | number) => new Vector($iter.fill(e, $type.number(c)))),

    first: op<MExpression>([MetaExpression.name],
        (v: MetaExpression) => {
        const vec = vector(v);
        return vec.length === 0 ? Trilean.Nil : vec.expressions[0];
    }),

    flatten: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => {
        const vec = vector(v);
        return new Vector(vec.expressions
            .map(x => x instanceof Vector ? x.expressions : [x]).flat())}),

    get: op<Expression>([MetaExpression.name, [MetaExpression.name, "number"]],
        (v: MetaExpression, i: MetaExpression | number) => {
            const n = $type.number(Expression.build(i))
            const vec = vector(v);

            if ($util.exceeds(n, vec.expressions))
                throw $err.Invalid("Index", n);

            return vec.expressions[n < 0 ? n + vec.length : n];
        }),

    has: op<Trilean>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: MExpression) => {
            const vec = vector(v);

            if (vec.length === 0)
                return Trilean.False;

            for (let expr of vec.expressions) {
                const res = Std.call("Logic","eq", expr, m) as Trilean

                if (res.isTrue)
                    return res;
            }

            return Trilean.False;
        }),

    indexOf: op<number>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: Expression) => {
            const vec = vector(v);
            const n1 = -1;

            if (vec.length === 0)
                return n1;

            for (let [i, expr] of vec.expressions.entries()) {
                const res = Std.call("Logic", "eq", expr, m) as Trilean;

                if (res.isTrue)
                    return i;
            }

            return n1;
        }),

    last: op<MExpression>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);
            return vec.length === 0 ? Trilean.Nil : $iter.last(vec.expressions)!;
        }),

    lastIndexOf: op<number>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: MExpression) => {
            const vec = vector(v);
            const n1 = -1;

            if (vec.length === 0)
                return n1

            for (let [i, expr] of vec.expressions.map(x => x).reverse().entries()) {

                const res = Std.call("Logic", "eq", expr, m) as Trilean

                if (res.isTrue)
                    return i;
            }

            return n1;
        }),

    len: op<number>([MetaExpression.name],
        (v: MetaExpression) => vector(v).length),
    
    padEnd: op<MetaExpression>(
        [
            MetaExpression.name,
            [MetaExpression.name, "number"],
            Parameter.optional(ExpressionTypes)],
        (v: MetaExpression, c: MetaExpression | number, p: Some<MExpression> = undefined) => {
            const n = $type.number(Expression.build(c));
            return new Vector(vector(v).expressions.concat($iter.padding(n, p ?? Trilean.Nil)));
        }),

    padStart: op<MetaExpression>(
        [
            MetaExpression.name,
            [MetaExpression.name, "number"],
            Parameter.optional(ExpressionTypes)],
        (v: MetaExpression, c: MetaExpression | number, p: Some<MExpression> = undefined) => {
            const n = $type.number(Expression.build(c));

            if (n === 0)
                return v;

            return new Vector($iter.padding(n, p ?? Trilean.Nil).concat(vector(v).expressions));
        }),

    prefix: op<MetaExpression>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);
            const n = vec.length;
            
            return n === 0 ? v : new Vector(vec.expressions.slice(0, n - 1));
        }),

    pull: op<Vector>([MetaExpression.name, [MetaExpression.name, "number"]],
        (v: MetaExpression, c: MetaExpression | number) => {
            const vec = vector(v);
            const n = $type.number(Expression.build(c));

            if ($util.exceeds(n, vec.expressions))
                throw $err.Invalid("Index", n);

            return n === 0 ? vec : new Vector(vec.expressions.slice(vec.length - n));
        }),

    push: op<Vector>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: MExpression) => new Vector([...vector(v).expressions, m])),

    range: op<Vector>(
        [
            [MetaExpression.name, "number"],
            Parameter.optional([MetaExpression.name, "number"]),
            Parameter.optional([MetaExpression.name, "number"])],
        (
            s: MetaExpression | number,
            e: Some<MetaExpression | number> = undefined,
            d: Some<MetaExpression | number> = undefined) => {

            const end = e ? $type.number(Expression.build(e)) : $type.number(Expression.build(s));
            const start = e ? $type.number(Expression.build(s)) : 0;
            let dist = d ? Math.abs($type.number(Expression.build(d))) : 1;

            const n = Math.ceil((end - start) / dist);
            dist = Math.sign(end - start) * dist;

            return new Vector(Array.from({length: n}, (_, i) => start + (dist * i)));
        }),

    repeat: op<Vector>([MetaExpression.name, Parameter.optional([MetaExpression.name, "number"])],
        (v: MetaExpression, c: MetaExpression | number = 1) => {
            const vec = vector(v);
            const n = $type.number(c);

            if (n <= 0 || vec.length === 0)
                return vec;

            return new Vector([vec.expressions, ...$iter.range(n).map(_ => vec.expressions)].flat());
        }),

    reverse: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => new Vector($iter.copy(vector(v).expressions).reverse())),

    suffix: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);
            return vec.length < 2 ? vec : new Vector(vec.expressions.slice(1));
        }),

    slice: op<Vector>(
        [
            MetaExpression.name,
            [MetaExpression.name, "number"],
            Parameter.optional([MetaExpression.name, "number"])],
        (v: MetaExpression, b: MetaExpression | number, e: Some<MetaExpression | number> = undefined) => {
            let vec = vector(v);
            const getind = (ind: number): number => {
                    if ($util.exceeds(ind, vec.length))
                        throw $err.Invalid("Index", ind);

                    return ind < 0 ? ind + vec.length : ind;
                }

                let [i, j] = [
                    getind($type.number(Expression.build(b))),
                    e ? getind($type.number(Expression.build(e))) : vec.length];

                vec = new Vector(vec.expressions.slice(...(i > j ? [j, i] : [i, j])));
                return i <= j ? vec : Std.call("Vectors", "reverse", vec);
        }),

    slide: op<Vector>(
        [MetaExpression.name, Parameter.optional([MetaExpression.name, "number"])],
        (v: MetaExpression, s: Some<MetaExpression | number> = undefined) => {
            const n = s ? $type.number(Expression.build(s)) : 1;

            if (n < 0)
                throw $err.Invalid("Value", n);

            const vec = vector(v);

            if (n === vec.length)
                return new Vector([v]);

            const windows: Vector[] = [];

            $iter.range(vec.length - n + 1).forEach(i =>
                windows.push(new Vector(vec.expressions.slice(i, i + n))));

            return new Vector(windows);
        }),

    startsWith: op<Trilean>([MetaExpression.name, ExpressionTypes],
        (v: MetaExpression, m: MExpression) => {
            const vec = vector(v);
            return vec.length === 0 ? Trilean.False : Std.call("Logic", "eq", vec.expressions[0], m);
        }),

    take: op<Vector>([MetaExpression.name, [MetaExpression.name, "number"]],
        (v: MetaExpression, c: MetaExpression | number) => {
            const n = $type.number(Expression.build(c));

            if (n <= 0)
                return new Vector();

            const vec = vector(v);

            return new Vector(vec.expressions.slice(0, Math.min(n, vec.length)));
        }),

    trim: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);

            if (vec.length === 0)
                return vec;

            const i = vec.expressions.findIndex(x => !(x instanceof Trilean && x.isNil));
            const j = vec.expressions.map(x => x).reverse().findIndex(x => !(x instanceof Trilean && x.isNil));

            return new Vector(vec.expressions.slice(i, j+1));
        }),

    trimEnd: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);

            if (vec.length === 0)
                return vec;

            const j = vec.expressions.map(x => x).reverse().findIndex(x => !(x instanceof Trilean && x.isNil));

            return new Vector(vec.expressions.slice(0, j+1));
        }),

    trimStart: op<Vector>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = vector(v);

            if (vec.length === 0)
                return vec;

            const i = vec.expressions.findIndex(x => !(x instanceof Trilean && x.isNil));

            return new Vector(vec.expressions.slice(i));
        }),

    zip: op<Vector>(
        [MetaExpression.name, MetaExpression.name, Parameter.optional(ExpressionTypes)],
        (v1: MetaExpression, v2: MetaExpression, fill: Some<MExpression>) => {
            fill = fill ?? Trilean.Nil;
            const [vec1, vec2] = [vector(v1), vector(v2)];
            const [l, k] = [vec1.length, vec2.length];

            if (l >= k)
                return new Vector(vec1.expressions
                    .map((x, i) => new Vector(
                        [x, i >= k ? fill! : vec2.expressions[i]])));

            return new Vector(vec2.expressions
                .map((y, i) => new Vector(
                    [i >= l ? fill! : vec1.expressions[i], y])));
        })
})