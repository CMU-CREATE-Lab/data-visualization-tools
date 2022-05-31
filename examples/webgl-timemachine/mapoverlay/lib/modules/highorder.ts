import {Evaluation, Expression, Lambda, Marker, MetaExpression, MExpression, Vector} from "../../lang/expression";
import {Module, op, Parameter} from "../../lang/operator";
import {$type} from "../../common";
import {Some} from "../../types";
import {ExpressionTypes} from "./common";
import {Std} from "../Std";

export const HighOrder = new Module();

const evaluation = (_: any) => $type.check<Evaluation>(_, Evaluation.name);
const lambda = (_: any) => $type.check<Lambda>(_, Lambda.name);

const func = (_: any) => {
    try {
        return evaluation(_);
    } catch {
        return lambda(_);
    }
};

HighOrder.overload("filter",
    op<Vector>([MetaExpression.name, MetaExpression.name],
        (f: MetaExpression, v: MetaExpression): Vector => {
            const p = func(f);
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return vec;

            const filtered: MExpression[] = [];

            for (let expr of vec.expressions) {
                const res = $type.trilean(p.build(expr));

                if (res.isTrue)
                    filtered.push(expr);
            }

            return new Vector(filtered);
        }),
    op<Vector>([Marker.name, MetaExpression.name],
        (f: Marker, v: MetaExpression) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return vec;

            const filtered: MExpression[] = [];

            for (let expr of vec.expressions) {
                const res = $type.trilean(Std.callOp(f.marker, expr));

                if (res.isTrue)
                    filtered.push(expr);
            }

            return new Vector(filtered);
        }));

HighOrder.overload("foldl",
    op<MExpression>([MetaExpression.name, MetaExpression.name, Parameter.optional(ExpressionTypes)],
        (f: MetaExpression, v: MetaExpression, s: Some<MExpression> = undefined) => {
            const a = func(f);
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return v;

            if (vec.length === 1)
                return s ? a.build(s, vec.expressions[0]) : vec.expressions[0];

            let agg = s ?? vec.expressions[0];
            const exprs = s ? vec.expressions : vec.expressions.slice(1);

            for (const expr of exprs)
                agg = a.build(agg, expr);

            return agg;
        }),
    op<MExpression>([Marker.name, MetaExpression.name, Parameter.optional(ExpressionTypes)],
        (a: Marker, v: MetaExpression, s: Some<MExpression> = undefined) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);
            
            if (vec.length === 0)
                return v;

            if (vec.length === 1)
                return s ? Std.callOp(a.marker, s, vec.expressions[0]) : vec.expressions[0];

            let agg = s ?? vec.expressions[0];
            const exprs = s ? vec.expressions : vec.expressions.slice(1);

            for (const expr of exprs)
                agg = Std.callOp(a.marker, agg, expr);

            return agg;
        }));

HighOrder.overload("foldr",
    op<MExpression>([MetaExpression.name, MetaExpression.name, Parameter.optional(ExpressionTypes)],
        (f: MetaExpression, v: MetaExpression, s: Some<MExpression> = undefined) => {
            const a = func(f);
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return v;

            if (vec.length === 1)
                return s ? a.build(s, vec.expressions[0]) : vec.expressions[0];

            let exprs = vec.expressions.map(x => x).reverse();
            let agg = s ?? exprs[0];
            exprs = s ? vec.expressions : vec.expressions.slice(1);

            for (const expr of exprs)
                agg = a.build(agg, expr);

            return agg;
        }),
    op<MExpression>([Marker.name, MetaExpression.name, Parameter.optional(ExpressionTypes)],
        (a: Marker, v: MetaExpression, s: Some<MExpression> = undefined) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return v;

            if (vec.length === 1)
                return s ? Std.callOp(a.marker, s, vec.expressions[0]) : vec.expressions[0];

            let exprs = vec.expressions.map(x => x).reverse();
            let agg = s ?? exprs[0];
            exprs = s ? vec.expressions : vec.expressions.slice(1);

            for (const expr of exprs)
                agg = Std.callOp(a.marker, agg, expr);

            return agg;
        }));

HighOrder.overload("map",
    op<Vector>([MetaExpression.name, MetaExpression.name],
        (f: MetaExpression, v: MetaExpression) => {
            f = func(f);
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);
            return new Vector(vec.expressions.map(x => f.build(x)));
        }),
    op<Vector>([Marker.name, MetaExpression.name],
        (f: Marker, v: MetaExpression) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);
            return new Vector(vec.expressions.map(x => Std.callOp(f.marker, x)))
        }));

HighOrder.overload("starmap",
    op<Vector>([MetaExpression.name, MetaExpression.name],
        (f: MetaExpression, v: MetaExpression) => {
            f = func(f);
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            return new Vector(vec.expressions
                    .map(x => f.build(...(x instanceof Vector ? x.expressions : [x]))))
        }),

    op<Vector>([Marker.name, [MetaExpression.name, Vector.name]],
        (f: Marker, v: MetaExpression) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);
            return new Vector(vec.expressions
                    .map(x => Std.callOp(f.marker, x instanceof Vector ? x.expressions : [x])))
        }));