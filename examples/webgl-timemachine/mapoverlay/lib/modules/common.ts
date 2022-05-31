import {Trilean} from "../../common";
import {MetaExpression} from "../../lang/expression";

export const PrimitiveTypes = ["number", "string", Trilean.name];
export const ExpressionTypes = [MetaExpression.name, ...PrimitiveTypes];