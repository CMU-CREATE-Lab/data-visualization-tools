import {Module, op} from "../../lang/operator";
import {$type, Trilean} from "../../common";
import {Expression, MetaExpression, Record} from "../../lang/expression";

type State = {
    abbreviation: string,
    fips: number,
    gnis: number,
    region: number,
    regionName: string,
    division: number,
    divisionName: string
}

const StateInfo: {[state: string]: State} = {
    "Alabama": {
        abbreviation: "AL",
        fips: 1,
        gnis: 1779775,
        region: 3,
        regionName: "South",
        division: 6,
        divisionName: "East South Central"
    },
    "Alaska": {
        abbreviation: "AK",
        fips: 2,
        gnis: 1785533,
        region: 4,
        regionName: "West",
        division: 9,
        divisionName: "Pacific"
    },
    "Arizona": {
        abbreviation: "AZ",
        fips: 4,
        gnis: 1779777,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "Arkansas": {
        abbreviation: "AR",
        fips: 5,
        gnis: 68085,
        region: 3,
        regionName: "South",
        division: 7,
        divisionName: "West South Central"
    },
    "California": {
        abbreviation: "CA",
        fips: 6,
        gnis: 1779778,
        region: 4,
        regionName: "West",
        division: 9,
        divisionName: "Pacific"
    },
    "Colorado": {
        abbreviation: "CO",
        fips: 8,
        gnis: 1779779,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "Connecticut": {
        abbreviation: "CT",
        fips: 9,
        gnis: 1779780,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "Delaware": {
        abbreviation: "DE",
        fips: 10,
        gnis: 1779781,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "District of Columbia": {
        abbreviation: "DC",
        fips: 11,
        gnis: 1702382,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Florida": {
        abbreviation: "FL",
        fips: 12,
        gnis: 294478,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Georgia": {
        abbreviation: "GA",
        fips: 13,
        gnis: 1705317,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Hawaii": {
        abbreviation: "HI",
        fips: 15,
        gnis: 1779782,
        region: 4,
        regionName: "West",
        division: 9,
        divisionName: "Pacific"
    },
    "Idaho": {
        abbreviation: "ID",
        fips: 16,
        gnis: 1779783,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "Illinois": {
        abbreviation: "IL",
        fips: 17,
        gnis: 1779784,
        region: 2,
        regionName: "Midwest",
        division: 3,
        divisionName: "East North Central"
    },
    "Indiana": {
        abbreviation: "IN",
        fips: 18,
        gnis: 448508,
        region: 2,
        regionName: "Midwest",
        division: 3,
        divisionName: "East North Central"
    },
    "Iowa": {
        abbreviation: "IA",
        fips: 19,
        gnis: 1779785,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Kansas": {
        abbreviation: "KS",
        fips: 20,
        gnis: 481813,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Kentucky": {
        abbreviation: "KY",
        fips: 21,
        gnis: 1779786,
        region: 3,
        regionName: "South",
        division: 6,
        divisionName: "East South Central"
    },
    "Louisiana": {
        abbreviation: "LA",
        fips: 22,
        gnis: 1629543,
        region: 3,
        regionName: "South",
        division: 7,
        divisionName: "West South Central"
    },
    "Maine": {
        abbreviation: "ME",
        fips: 23,
        gnis: 1779787,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "Maryland": {
        abbreviation: "MD",
        fips: 24,
        gnis: 1714934,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Massachusetts": {
        abbreviation: "MA",
        fips: 25,
        gnis: 606926,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "Michigan": {
        abbreviation: "MI",
        fips: 26,
        gnis: 1779789,
        region: 2,
        regionName: "Midwest",
        division: 3,
        divisionName: "East North Central"
    },
    "Minnesota": {
        abbreviation: "MN",
        fips: 27,
        gnis: 662849,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Mississippi": {
        abbreviation: "MS",
        fips: 28,
        gnis: 1779790,
        region: 3,
        regionName: "South",
        division: 6,
        divisionName: "East South Central"
    },
    "Missouri": {
        abbreviation: "MO",
        fips: 29,
        gnis: 1779791,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Montana": {
        abbreviation: "MT",
        fips: 30,
        gnis: 767982,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "Nebraska": {
        abbreviation: "NE",
        fips: 31,
        gnis: 1779792,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Nevada": {
        abbreviation: "NV",
        fips: 32,
        gnis: 1779793,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "New Hampshire": {
        abbreviation: "NH",
        fips: 33,
        gnis: 1779794,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "New Jersey": {
        abbreviation: "NJ",
        fips: 34,
        gnis: 1779795,
        region: 1,
        regionName: "Northeast",
        division: 2,
        divisionName: "Middle Atlantic"
    },
    "New Mexico": {
        abbreviation: "NM",
        fips: 35,
        gnis: 897535,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "New York": {
        abbreviation: "NY",
        fips: 36,
        gnis: 1779796,
        region: 1,
        regionName: "Northeast",
        division: 2,
        divisionName: "Middle Atlantic"
    },
    "North Carolina": {
        abbreviation: "DE",
        fips: 37,
        gnis: 1027616,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "North Dakota": {
        abbreviation: "ND",
        fips: 38,
        gnis: 1779797,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Ohio": {
        abbreviation: "OH",
        fips: 39,
        gnis: 1085497,
        region: 2,
        regionName: "Midwest",
        division: 3,
        divisionName: "East North Central"
    },
    "Oklahoma": {
        abbreviation: "OK",
        fips: 40,
        gnis: 1102857,
        region: 3,
        regionName: "South",
        division: 7,
        divisionName: "West South Central"
    },
    "Oregon": {
        abbreviation: "OR",
        fips: 41,
        gnis: 1155107,
        region: 4,
        regionName: "West",
        division: 9,
        divisionName: "Pacific"
    },
    "Pennsylvania": {
        abbreviation: "PA",
        fips: 42,
        gnis: 1779798,
        region: 1,
        regionName: "Northeast",
        division: 2,
        divisionName: "Middle Atlantic"
    },
    "Rhode Island":{
        abbreviation: "RI",
        fips: 44,
        gnis: 1219835,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "South Carolina": {
        abbreviation: "SC",
        fips: 45,
        gnis: 1779799,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "South Dakota": {
        abbreviation: "SD",
        fips: 46,
        gnis: 1785534,
        region: 2,
        regionName: "Midwest",
        division: 4,
        divisionName: "West North Central"
    },
    "Tennessee": {
        abbreviation: "TN",
        fips: 47,
        gnis: 1325873,
        region: 3,
        regionName: "South",
        division: 6,
        divisionName: "East South Central"
    },
    "Texas": {
        abbreviation: "TX",
        fips: 48,
        gnis: 1779801,
        region: 3,
        regionName: "South",
        division: 7,
        divisionName: "West South Central"
    },
    "Utah": {
        abbreviation: "UT",
        fips: 49,
        gnis: 1455989,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    },
    "Vermont": {
        abbreviation: "VT",
        fips: 50,
        gnis: 1779802,
        region: 1,
        regionName: "Northeast",
        division: 1,
        divisionName: "New England"
    },
    "Virginia": {
        abbreviation: "VA",
        fips: 51,
        gnis: 1779803,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Washington": {
        abbreviation: "WA",
        fips: 53,
        gnis: 1779804,
        region: 4,
        regionName: "West",
        division: 9,
        divisionName: "Pacific"
    },
    "West Virginia": {
        abbreviation: "WV",
        fips: 54,
        gnis: 1779805,
        region: 3,
        regionName: "South",
        division: 5,
        divisionName: "South Atlantic"
    },
    "Wisconsin": {
        abbreviation: "WI",
        fips: 55,
        gnis: 1779806,
        region: 2,
        regionName: "Midwest",
        division: 3,
        divisionName: "East North Central"
    },
    "Wyoming": {
        abbreviation: "WY",
        fips: 56,
        gnis: 1779807,
        region: 4,
        regionName: "West",
        division: 8,
        divisionName: "Mountain"
    }
}

export const States = Module.from({
    abbr: op<string>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.abbreviation ?? ""),

    div: op<number>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.division ?? -1),

    divi: op<string>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.divisionName ?? ""),

    fips: op<number>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.fips ?? -1),

    fromAbbr: op<string>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) => {
            const abbr = $type.string(Expression.build(n)).trim();
            return Object.entries(StateInfo)
                .find(([_, md]) =>
                    md.abbreviation === abbr)?.[0] ?? "";
        }),

    fromFIPS: op<string>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number) => {
            const fips = $type.number(Expression.build(n));
            return Object.entries(StateInfo)
                .find(([_, md]) =>
                    md.fips === fips)?.[0] ?? "";
        }),

    fromGNIS: op<string>([[MetaExpression.name, "number"]],
        (n: MetaExpression | number) => {
            const gnis = $type.number(Expression.build(n));
            return Object.entries(StateInfo)
                .find(([_, md]) =>
                    md.gnis === gnis)?.[0] ?? "";
        }),

    gnis: op<number>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.gnis ?? -1),

    meta: op<Record>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            new Record(StateInfo[$type.string(Expression.build(n))] ?? {})),

    rgn: op<number>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.region ?? -1),

    rgni: op<string>([[MetaExpression.name, "string"]],
        (n: MetaExpression | string) =>
            StateInfo[$type.string(Expression.build(n))]?.regionName ?? ""),
})