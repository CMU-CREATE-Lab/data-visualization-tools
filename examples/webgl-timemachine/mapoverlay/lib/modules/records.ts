import {Module, op} from "../../lang/operator";
import {$err, $type, Trilean} from "../../common";
import {Expression, Marker, MetaExpression, MExpression, Record, Vector} from "../../lang/expression";
import {Std} from "../Std";

const record = (_: any) => $type.check<Record>(Expression.build(_), Record.name);

export const Records = Module.from({
    describe: op<Record>([MetaExpression.name, Record.name],
        (r: MetaExpression, s: Record) => {
            const temp = Module.from({"@source": op<Record>([], () => s)});

            Std.add(temp, "___temp___");

            const target = record(r.build());

            Std.remove("___temp___");

            return target;
        }),

    fields: op<Vector>([MetaExpression.name], (r: MetaExpression) =>
        new Vector(Object.getOwnPropertyNames(record(r).object))),

    get: op<MExpression>([MetaExpression.name, [MetaExpression.name, "string"]],
        (r: MetaExpression, k: MetaExpression | string) => {
            const rec = record(r);
            const key = $type.string(Expression.build(k));
            return key in rec.object ? rec.object[key] : $err.throw_($err.Invalid("Key", key));
        }),

    has: op<Trilean>([MetaExpression.name, [MetaExpression.name, "string"]],
        (r: MetaExpression, k: MetaExpression | string) =>
            Trilean.of($type.string(Expression.build(k)) in record(r).object)),

    record: op<Record>([MetaExpression.name],
        (v: MetaExpression) => {
            const vec = $type.check<Vector>(Expression.build(v), Vector.name);

            if (vec.length === 0)
                return new Record();

            return Record.fromIterable(vec.expressions.map(x => {
                const entry = $type.check<Vector>(x, Vector.name);

                if ((entry.length !== 1) && (entry.length !== 2))
                    throw $err.Invalid(
                        "Field-Value",
                        `[${entry.expressions.map(x => x.toString()).join(',')}]`);

                return [
                    $type.string(Expression.build(entry.expressions[0])),
                    entry.length === 1 ? Trilean.Nil : entry.expressions[1]];
            }));
        }),
    
    size: op<number>([MetaExpression.name],
        (r: MetaExpression) => Object.keys(record(r).object).length)
});

Records.overload("seek",
    op<MExpression>([MetaExpression.name, MetaExpression.name],
        (r: MetaExpression, p: MetaExpression) => {
            let expr = r;

            const vec = $type.check<Vector>(Expression.build(p), Vector.name);
            const path = vec.expressions.map(x => $type.string(Expression.build(x)));

            for (let key of path) {
                let rec = record(expr);
                expr = Std.call("Records", "get", rec, key);
            }

            return expr;
        }
    ),
    op<Expression>([Marker.name, MetaExpression.name],
        (l: Marker, p: MetaExpression) =>
            Std.call("Records", "seek", Std.callOp(l.marker), p)));