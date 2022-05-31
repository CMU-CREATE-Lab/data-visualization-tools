import {Accordion} from "./lang/accordion";
import {Std} from "./lib/Std";
import {Arithmetic, Numerics} from "./lib/modules/numerics";
import {HighOrder} from "./lib/modules/highorder";
import {Logic} from "./lib/modules/logic";
import {Records} from "./lib/modules/records";
import {States} from "./lib/modules/states";
import {Strings} from "./lib/modules/strings";
import {Vectors} from "./lib/modules/vectors";

import type {MExpression} from "./lang/expression";
import {$err, $type, Trilean} from "./common";
import {Expression, Record, Vector} from "./lang/expression";

import type {Some} from "./types";

Std.add(Arithmetic, "Arithmetic");
Std.add(HighOrder, "HighOrder");
Std.add(Logic, "Logic");
Std.add(Numerics, "Numerics");
Std.add(Records, "Records");
Std.add(States, "States");
Std.add(Strings, "Strings");
Std.add(Vectors, "Vectors");

export {Std as MZL};

export class OverlayEngine {
    static build(text: string): MExpression {
        return Expression.build(OverlayEngine.parse(text));
    }

    static describe(text: string, source: { [key: string]: any }): MExpression {
        const mxpr = OverlayEngine.parse(text);
        const src = Std.call("Strings", "json", JSON.stringify(source));

        return Std.call("Records", "describe", mxpr, src);
    }

    static objectify(mxpr: MExpression): any {
        switch (typeof mxpr) {
            case "string":
            case "number":
                return mxpr;
            default:
                if (mxpr instanceof Trilean)
                    return mxpr.isTrue ? true : mxpr.isFalse ? false : undefined;

                if (mxpr instanceof Vector)
                    return [mxpr.expressions.map(x => OverlayEngine.objectify(x))];

                if (mxpr instanceof Record)
                    return Object.fromEntries(Object.entries(mxpr.object)
                            .map(([k, v]) => [k, OverlayEngine.objectify(v)]));

                throw $err.Invalid("JSON Element", `Expected object, array, number, boolean, or undefined: ${$type.kindOf(mxpr)}`)
        }
    }

    static model(target: string, source: Some<{ [key: string]: any }> = undefined) {
        return OverlayEngine.objectify(source ? OverlayEngine.describe(target, source) : OverlayEngine.build(target));
    }

    static parse(text: string): MExpression {
        return Accordion.expand(text);
    }
}
