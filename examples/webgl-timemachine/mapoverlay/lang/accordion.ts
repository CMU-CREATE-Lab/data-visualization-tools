import * as mezzo from "./parser";
import {ASTKinds} from "./parser";
import {Evaluation, Expression, Lambda, Marker, MExpression, Record, Vector} from "./expression";
import {$err, $type, Ideograph, Trilean} from "../common";
import {Std} from "../lib/Std";

export class Accordion {

    static expand(mxpr: string): MExpression {
        const [squeezed, imap] = Ideograph.squeeze(mxpr);

        if (squeezed.length === 0)
            return Trilean.Nil;

        if (squeezed === "[]")
            return new Vector();

        const res = mezzo.parse(squeezed);

        if (res.errs.length === 0)
            return Accordion.expression(res.ast!.expr);

        return Accordion.syntaxError(res, squeezed, imap);
    }

    private static additive(ast: mezzo.Additive): MExpression {
        let sum: MExpression = Accordion.multiplicative(ast.expr);

        ast.tail.forEach(mexpr => {
            const marker = Marker.for(mexpr.op);
            let mul = Accordion.multiplicative(mexpr.expr);

            if ($type.allNumbers([sum, mul])) {
                sum = Std.call("Arithmetic", marker.marker, sum, mul);
                return;
            }

            sum = new Evaluation(marker, true, sum, mul);
        });

        return sum;
    }

    private static atom(ast: mezzo.Atom): MExpression {
        let expr;

        switch (ast.expr.kind) {
            case mezzo.ASTKinds.Vector:
                expr = Accordion.vector(ast.expr);
                break;
            case mezzo.ASTKinds.Evaluation:
                expr = Accordion.evaluation(ast.expr);
                break;
            default:
                expr = Accordion.primitive(ast.expr);
        }

        if (ast.op && (expr instanceof Vector))
            return new Evaluation(Marker.for(ast.op), false, ...expr.expressions);

        if (!ast.op || ast.op === '+')
            return expr;

        const op = ast.op === '~' ? ast.op : "u-";
        const marker = Marker.for(op);

        if (typeof expr === "number" || (expr instanceof Trilean && op === '~'))
            return Std.call(typeof expr === "number" ? "Arithmetic" : "Logic", marker.marker, expr);

        return new Evaluation(marker, true, expr);
    }

    private static bitwiseAnd(ast: mezzo.BitwiseAnd): MExpression {
        let and: MExpression = Accordion.shift(ast.expr);
        const marker = Marker.for("and");

        ast.tail.forEach(mexpr => {
            const shift = Accordion.shift(mexpr.expr);

            if ($type.allNumbers([and, shift])) {
                and = Std.call("Arithmetic", marker.marker, and, shift);
                return;
            }

            and = new Evaluation(marker, true, and, shift);
        });

        return and;
    }

    private static bitwiseOr(ast: mezzo.BitwiseOr): MExpression {
        let or: MExpression = Accordion.bitwiseXor(ast.expr);
        const marker = Marker.for("or");

        ast.tail.forEach(mexpr => {
            const xor = Accordion.bitwiseXor(mexpr.expr);

            if ($type.allNumbers([or, xor])) {
                or = Std.call("Arithmetic", marker.marker, or, xor);
                return;
            }

            or = new Evaluation(marker, true, or, xor);
        });

        return or;
    }

    private static bitwiseXor(ast: mezzo.BitwiseXor): MExpression {
        let xor: MExpression = Accordion.bitwiseAnd(ast.expr);
        const marker = Marker.for("xor");

        ast.tail.forEach(mexpr => {
            const and = Accordion.bitwiseAnd(mexpr.expr);

            if ($type.allNumbers([xor, and])) {
                xor = Std.call("Arithmetic", marker.marker, xor, and);
                return;
            }

            xor = new Evaluation(marker, true, xor, and);
        });

        return xor;
    }

    private static comparison(ast: mezzo.Comparison): MExpression {
        if (ast.tail.length === 0)
            return Accordion.bitwiseOr(ast.expr);

        let left: MExpression = Accordion.bitwiseOr(ast.expr);
        let right: MExpression = Accordion.bitwiseOr(ast.tail[0].expr);
        let cmp = new Evaluation(Marker.for(ast.tail[0].op), false, left, right);

        if (ast.tail.length === 1)
            return cmp;

        left = right;

        ast.tail.slice(1).forEach(mexpr => {
            right = Accordion.bitwiseOr(mexpr.expr);
            cmp = new Evaluation(
                Marker.for("and"),
                true,
                cmp, new Evaluation(Marker.for(mexpr.op), true, left, right));

            left = right;
        });

        return cmp;
    }

    private static composition(ast: mezzo.Composition): MExpression {
        const head = Accordion.highOrderFunction(ast.expr);

        if (!ast.tail)
            return head;

        const comp = Accordion.composition(ast.tail.expr);

        if (!((head instanceof Marker) || head instanceof Evaluation || head instanceof Lambda))
            throw $err.Invalid("Syntax", `Expected composable function: ${Expression.str(head)}`)

        return head instanceof Marker
            ? new Evaluation(head, false, comp)
            : head.curry(comp);
    }

    private static entry(ast: mezzo.Entry): [string, MExpression] {
        const expr = ast.expr;

        if ("alias" in expr || expr.value == undefined)
            return [
                "alias" in expr ? expr.alias.value : expr.key.value,
                new Evaluation(
                    Marker.for("seek"),
                    false,
                    Marker.for("@source"),
                    Vector.contain(expr.key.value))];

        return [expr.key.value, Accordion.expression(expr.value.expr)];
    }

    private static equality(ast: mezzo.Equality): MExpression {
        if (ast.tail.length === 0)
            return Accordion.comparison(ast.expr);

        let left: MExpression = Accordion.comparison(ast.expr);
        let right: MExpression = Accordion.comparison(ast.tail[0].expr);
        let cmp = new Evaluation(Marker.for(ast.tail[0].op), false, left, right);

        if (ast.tail.length === 1)
            return cmp;

        left = right;

        ast.tail.slice(1).forEach(mexpr => {
            right = Accordion.comparison(mexpr.expr);
            cmp = new Evaluation(
                Marker.for("and"),
                true,
                cmp, new Evaluation(Marker.for(mexpr.op), true, left, right));

            left = right;
        });

        return cmp;
    }

    private static exponential(ast: mezzo.Exponential): MExpression {
        const base = Accordion.composition(ast.expr);

        if (!ast.tail)
            return base;

        const exponent = Accordion.exponential(ast.tail.expr);

        if ($type.allNumbers([base, exponent]))
            return Std.call("Arithmetic", "pow", base, exponent);

        return new Evaluation(Marker.for("pow"), true, base, exponent);
    }

    private static expression(ast: mezzo.Expression): MExpression {
        if (ast.kind === ASTKinds.Record)
            return Accordion.record(ast);

        let coalescence: MExpression =
            ast.expr.kind === ASTKinds.Record
                ? Accordion.record(ast.expr)
                : Accordion.logicalOr(ast.expr);

        ast.tail.forEach(mexpr =>
            coalescence = new Evaluation(
                Marker.for(mexpr.op), false,
                coalescence,
                mexpr.expr.kind === ASTKinds.Record
                    ? Accordion.record(mexpr.expr)
                    : Accordion.logicalOr(mexpr.expr)));

        return coalescence;
    }

    private static evaluation(ast: mezzo.Evaluation): Marker | Evaluation | Lambda {
        if (ast.expr.kind === mezzo.ASTKinds.Lambda)
            return Accordion.lambda(ast.expr, !!ast.eager);

        if (ast.expr.label.value === '$') {
            return new Evaluation(Marker.for("seek"),
                !!ast.eager,
                Marker.for("@source"),
                ast.expr.vector
                    ? (<Vector>Accordion.vector(ast.expr.vector, true))
                    : new Vector());
        }

        const marker = Marker.for(ast.expr.label.value);

        if (!ast.expr.vector)
            return ast.eager ? new Evaluation(marker, true) : marker;

        const vector = <Vector>Accordion.vector(ast.expr.vector, true);
        return new Evaluation(marker, !!ast.eager, ...vector.expressions);
    }

    private static highOrderFunction(ast: mezzo.HighOrderFunction): MExpression {
        const left = Accordion.atom(ast.expr);

        if (!ast.tail)
            return left;

        const hof = Accordion.highOrderFunction(ast.tail.expr);
        return new Evaluation(Marker.for(ast.tail.op), false, left, hof);
    }

    private static lambda(ast: mezzo.Lambda, eager: boolean = false): Lambda {
        const defn = ast.expr.body;
        const parameters = defn.parameters == undefined
            ? []
            : defn.parameters.tail.length === 0
                ? [Marker.for((defn.parameters.mark.value))]
                : [Marker.for(defn.parameters.mark.value),
                    ...defn.parameters.tail.map(p => Marker.for(p.mark.value))];

        const body = Accordion.expression(defn.body);
        const variadic = !!defn.parameters?.variadic;
        const partial = defn.partial ? (<Vector>Accordion.vector(defn.partial.args, true)).expressions : [];

        return new Lambda(parameters, body, variadic, eager, ...partial);
    }

    private static logicalAnd(ast: mezzo.LogicalAnd): MExpression {
        let and: MExpression =Accordion.equality(ast.expr);
        const marker = Marker.for("and");

        ast.tail.forEach(mexpr => {
            const eq = Accordion.equality(mexpr.expr);

            if ($type.sameType([and, eq], Trilean.name)) {
                and = Std.call("Logic", marker.marker, and, eq);
                return;
            }

            and = new Evaluation(marker, true, and, eq);
        });

        return and;
    }

    private static logicalImplication(ast: mezzo.LogicalImplication): MExpression {
        let imp: MExpression =Accordion.logicalAnd(ast.expr);

        ast.tail.forEach(mexpr => {
            const marker = Marker.for(mexpr.op);
            const and = Accordion.logicalAnd(mexpr.expr);

            if ($type.sameType([imp, and], Trilean.name)) {
                imp = Std.call("Logic", marker.marker, imp, and);
                return;
            }

            imp = new Evaluation(marker, true, imp, and);
        });

        return imp;
    }

    private static logicalOr(ast: mezzo.LogicalOr): MExpression {
        let or: MExpression =Accordion.logicalImplication(ast.expr);
        const marker = Marker.for("or");

        ast.tail.forEach(mexpr => {
            const imp = Accordion.logicalImplication(mexpr.expr);

            if ($type.sameType([or, imp], Trilean.name)) {
                or = Std.call("Logic", marker.marker, or, imp);
                return;
            }

            or = new Evaluation(marker, true, or, imp);
        });

        return or;
    }

    private static multiplicative(ast: mezzo.Multiplicative): MExpression {
        let mul: MExpression = Accordion.exponential(ast.expr);

        ast.tail.forEach(mexpr => {
            const exp = Accordion.exponential(mexpr.expr);
            const marker = Marker.for(mexpr.op);

            if ($type.allNumbers([mul, exp])) {
                mul = Std.call("Arithmetic", marker.marker, mul, exp);
                return;
            }

            mul = new Evaluation(marker, true, mul, exp);
        });

        return mul;
    }

    private static primitive(ast:mezzo.Primitive): number | string | Trilean {
        return ast.kind === mezzo.ASTKinds.TRILEAN ? Trilean.of(ast.value) : ast.value;
    }

    private static record(ast: mezzo.Record): Record {
        return ast.entries == undefined
            ? new Record()
            : Record.fromIterable([
                Accordion.entry(ast.entries.entry),
                ...ast.entries.tail.map(e => Accordion.entry(e.entry))]);
    }

    private static shift(ast: mezzo.Shift): MExpression {
        let shf: MExpression = Accordion.additive(ast.expr);

        ast.tail.forEach(mexpr => {
            const sum = Accordion.additive(mexpr.expr);
            const marker = Marker.for(mexpr.op);

            if ($type.allNumbers([shf, sum])) {
                shf = Std.call("Arithmetic", marker.marker, shf, sum);
                return;
            }

            shf = new Evaluation(marker, true, shf, sum);
        });

        return shf;
    }

    private static vector(ast: mezzo.Vector | mezzo.FVector, contain: boolean = false): MExpression {
        if (!ast.items)
            return new Vector();

        const head = Accordion.expression(ast.items.head);

        if (ast.items.tail.length === 0)
            return ast.items.asList || contain
                ? new Vector([head])
                : head;

        return new Vector([
            head,
            ...ast.items.tail.map(mexpr => Accordion.expression(mexpr.expr))]);
    }

    private static syntaxError(res: mezzo.ParseResult, squeezed: string, imap:  Map<number, {line: number, index: number}>): MExpression {
        const err = res.errs[0];
        const pos = imap.get(err.pos.overallPos)!;
        const input = `${squeezed.slice(err.pos.overallPos - 5, err.pos.overallPos + 6)}`;
        const expected = err.expmatches.map(match =>
            "literal" in match
                ? match.literal
                : match);

        throw $err.Invalid(
            "Syntax",
`{
          line: ${pos.line}, 
          index: ${pos.index}, 
          input: ${input}
               -----^-----, 
          expected: ${expected}
        }`);
    }
}