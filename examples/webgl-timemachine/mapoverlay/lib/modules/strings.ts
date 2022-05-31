import {Module, op, Parameter} from "../../lang/operator";
import {Expression, MetaExpression, MExpression, Record, Vector} from "../../lang/expression";
import {$err, $type, $util, Trilean} from "../../common";
import {Some} from "../../types";
import {Std} from "../Std";

export const Strings = Module.from({
        capitalize: op<string>([[MetaExpression.name, "string"]],
            (s: MetaExpression | string) => {
                const str = $type.string(s);
                return str.length > 0 ? `${str.charAt(0).toUpperCase()}${str.slice(1)}` : "";
            }),

        cat: op<string>([Parameter.variadic([MetaExpression.name, "string"])],
            (...strs: (MetaExpression | "string")[]) => {
                return strs.map(str => $type.string(Expression.build(str))).join("");
            }),

        charAt: op<string>([[MetaExpression.name, "string"], [MetaExpression.name, "number"]],
            (s: MetaExpression | string, n: MetaExpression | number) => {
                const str = $type.string(s);
                const [i, l] = [$type.number(Expression.build(n)), str.length];

                if ($util.exceeds(i, l))
                    throw $err.Invalid("Index", i);

                return str.charAt(i);
            }),

        codeAt: op<number>([[MetaExpression.name, "string"], [MetaExpression.name, "number"]],
        (s: MetaExpression | string, n: MetaExpression | number) => {
            const str = $type.string(s);
            const [i, l] = [$type.number(Expression.build(n)), str.length];

            if ($util.exceeds(i, l))
                throw $err.Invalid("Index", i);

            return str.charCodeAt(i);
        }),

        endsWith: op<Trilean>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string) =>
                Trilean.of($type.string(s).endsWith($type.string(Expression.build(p))))),

        has: op<Trilean>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string) =>
                Trilean.of($type.string(s).includes($type.string(Expression.build(p))))),

        indexOf: op<number>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string) =>
                $type.string(s).indexOf($type.string(Expression.build(p)))),

        join: op<string>([[MetaExpression.name, "string"], MetaExpression.name],
            (sep: MetaExpression | "string", strs: MetaExpression) => {
                return $type.check<Vector>(Expression.build(strs), Vector.name)
                    .expressions
                    .map(str => $type.string(Expression.build(str)))
                    .join($type.string(Expression.build(sep)));
            }),

        json: op<MExpression>([[MetaExpression.name, "string"]],
            (s: MetaExpression | string) => {
                const parse = (obj: any): MExpression => {
                    if (!obj)
                        return Trilean.Nil;

                    switch (typeof obj) {
                        case "number":
                        case "string":
                            return obj;
                        case "boolean":
                            return Trilean.of(obj);
                        default:
                            if (Array.isArray(obj))
                                return new Vector(obj.map(x => parse(x)));

                            const props: { [key: string]: MExpression } = {};

                            for (let key in obj)
                                props[key] = parse(obj[key]);

                            return new Record(props);
                    }
                }

                return parse(JSON.parse($type.string(s)));
            }),

        lastIndexOf: op<number>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string) =>
                $type.string(s).lastIndexOf($type.string(Expression.build(p)))),

        len: op<number>([[MetaExpression.name, "string"]], (s: MetaExpression | string) =>
            $type.string(s).length),

        mul: op<string>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (m: MetaExpression | string, n: MetaExpression | string) =>
                `${$type.string(Expression.build(m))}${$type.string(Expression.build(n))}`,
            true),

        padEnd: op<string>(
            [
                [MetaExpression.name, "string"],
                [MetaExpression.name, "number"],
                Parameter.optional([MetaExpression.name, "string"])],
            (
                s: MetaExpression | string,
                c: MetaExpression | number,
                p: Some<MetaExpression | string> = undefined) => {
                const str = $type.string(s);
                const n = Math.max(0, $type.number(Expression.build(c)));
                const pad = p ? $type.string(Expression.build(p)) : "";

                return str.padEnd(str.length + (n * pad.length), pad);
            }),

        padStart: op<string>(
            [
                [MetaExpression.name, "string"],
                [MetaExpression.name, "number"],
                Parameter.optional([MetaExpression.name, "string"])],
            (
                s: MetaExpression | string,
                c: MetaExpression | number,
                p: Some<MetaExpression | string> = undefined) => {
                const str = $type.string(s);
                const n = Math.max(0, $type.number(Expression.build(c)));
                const pad = p ? $type.string(Expression.build(p)) : "";

                return str.padStart(str.length + (n * pad.length), pad);
            }),

        repeat: op<string>([[MetaExpression.name, "string"], [MetaExpression.name, "number"]],
            (s: MetaExpression | string, c: MetaExpression | number) => {
                const str = $type.string(s);
                const n = $type.number(Expression.build(c));
                return n < 1 ? str : str.repeat(n);
            }),

        replace: op<string>(
            [[MetaExpression.name, "string"], [MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string, r: MetaExpression | string) => {
                const pat = $type.string(Expression.build(p));
                const rep = $type.string(Expression.build(r));
                return $type.string(s).replace(pat, rep);
            }),

        reverse: op<string>([[MetaExpression.name, "string"]], (s: MetaExpression | string) =>
            Array.from($type.string(s)).reverse().join('')),

        slice: op<string>(
            [
                [MetaExpression.name, "string"],
                [MetaExpression.name, "number"],
                Parameter.optional([MetaExpression.name, "number"])],
            (
                s: MetaExpression | string,
                b: MetaExpression | number,
                e: Some<MetaExpression | number> = undefined) => {
                let str = $type.string(s);

                const checkind = (ind: number): number => {
                    if ($util.exceeds(ind, str))
                        throw $err.Invalid("Index", ind);

                    return ind < 0 ? ind + str.length : ind;
                }

                let [i, j] = [
                    checkind($type.number(Expression.build(b))),
                    e ? checkind($type.number(Expression.build(e))) : str.length];

                if (i > j)
                    [i, j] = [j, i];

                str = str.substring(i, j);
                return i <= j ? str : <string>Std.call("Strings", "reverse", str);
            }),

        startsWith: op<Trilean>([[MetaExpression.name, "string"], [MetaExpression.name, "string"]],
            (s: MetaExpression | string, p: MetaExpression | string) =>
                Trilean.of($type.string(s).startsWith($type.string(Expression.build(p))))),

        toLower: op<string>([[MetaExpression.name, "string"]],
            (s: MetaExpression | string) => $type.string(s).toLowerCase()),

        toUpper: op<string>([[MetaExpression.name, "string"]],
            (s: MetaExpression | string) => $type.string(s).toUpperCase()),

        trim: op<string>(
            [[MetaExpression.name, "string"], Parameter.optional([MetaExpression.name, "string"])],
            (s: MetaExpression | string, c: Some<MetaExpression | string> = undefined) =>
                Std.call("Strings", "trimStart", Std.call("Strings", "trimEnd", s, c), c)),

        trimEnd: op<string>(
        [[MetaExpression.name, "string"], Parameter.optional([MetaExpression.name, "string"])],
        (s: MetaExpression | string, c: Some<MetaExpression | string> = undefined) => {
            let str = $type.string(Expression.build(s));

            if (c == undefined)
                return str.trimEnd();

            const chars = new Set($type.string(Expression.build(c)));
            let i = str.length;

            while(i >= 0 && chars.has(str.charAt((i))))
                i--;

            return str.slice(0, i + 1);
        }),

        trimStart: op<string>(
        [[MetaExpression.name, "string"], Parameter.optional([MetaExpression.name, "string"])],
        (s: MetaExpression | string, c: Some<MetaExpression | string> = undefined) => {
            let str = $type.string(Expression.build(s));

            if (c == undefined)
                return str.trimStart();

            const chars = new Set($type.string(Expression.build(c)));
            let i = 0;

            while (i < str.length && chars.has(str.charAt(i)))
                i++;

            return str.slice(i);
        }),
    });