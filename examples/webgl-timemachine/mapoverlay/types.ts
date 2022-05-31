export type Class<T = any> = new (..._:any[]) => T;
export type Mapping<T = any> = Map<string, T> | {[key: string]: T};
export type NamedType = string | Class;
export type ParameterType<T = NamedType, R = any> = T | PredicateType<T> | RestrictedType<T, R> | T[];
export type Predicate<T = any> = (_:T) => boolean;
export type PredicateType<T = NamedType> = {type: UnitOrArray<T>, clause: Predicate};
export type Prototype<T = any> = (..._: any[]) => T;
export type RestrictedType<T = NamedType, R = any> = {type: UnitOrArray<T>, restrictions: R[]};
export type Signature = {
    arity: number,
    rank: number,
    commutative: boolean,
    variadic: boolean
};
export type Some<T = any> = T | undefined;
export type TypeCheckerFunction = "accepts" | "takes";
export type UnitOrArray<T> = T | T[];

export enum TypeChecker {
    Accepts = "accepts",
    Takes = "takes"
}