import type { SQL } from "pg-sql2";
import sql from "pg-sql2";
import { parse as arrayParse } from "postgres-array";

import type {
  PgBox,
  PgCircle,
  PgHStore,
  PgInterval,
  PgLine,
  PgLseg,
  PgPath,
  PgPoint,
  PgPolygon,
} from "./codecUtils";
import {
  parseBox,
  parseCircle,
  parseHstore,
  parseInterval,
  parseLine,
  parseLseg,
  parsePath,
  parsePoint,
  parsePolygon,
  stringifyBox,
  stringifyCircle,
  stringifyHstore,
  stringifyInterval,
  stringifyLine,
  stringifyLseg,
  stringifyPath,
  stringifyPoint,
  stringifyPolygon,
} from "./codecUtils";
import type { PgSourceColumns } from "./datasource";
import { exportAs } from "./exportAs";
import type {
  PgEncode,
  PgEnumTypeCodec,
  PgTypeCodec,
  PgTypeCodecExtensions,
} from "./interfaces";

// TODO: optimisation: `identity` can be shortcut
const identity = <T>(value: T): T => value;

type SupportedPostgresType =
  | "bool"
  | "int2"
  | "int4"
  | "bigint"
  | "float4"
  | "float"
  | "money"
  | "numeric"
  | "char"
  | "varchar"
  | "text"
  | "json"
  | "jsonb"
  | "citext"
  | "uuid"
  | "timestamp"
  | "timestamptz"
  | "date"
  | "time"
  | "timetz"
  | "inet"
  | "regproc"
  | "regprocedure"
  | "regoper"
  | "regoperator"
  | "regclass"
  | "regtype"
  | "regrole"
  | "regnamespace"
  | "regconfig"
  | "regdictionary"
  | "cidr"
  | "macaddr"
  | "macaddr8"
  | "interval"
  | "bit"
  | "varbit"
  | "point"
  | "line"
  | "lseg"
  | "box"
  | "path"
  | "polygon"
  | "circle"
  | "hstore";

const pg2gqlForType = (type: SupportedPostgresType): ((value: any) => any) => {
  switch (type) {
    case "int2":
    case "int4": {
      return (value: any) => parseInt(value, 10);
    }
    case "float":
    case "float4": {
      return (value: any) => parseFloat(value);
    }
    case "bool": {
      return (value: any) => value === "true";
    }
    case "interval": {
      return parseInterval;
    }
    case "point": {
      return parsePoint;
    }
    case "line": {
      return parseLine;
    }
    case "lseg": {
      return parseLseg;
    }
    case "box": {
      return parseBox;
    }
    case "path": {
      return parsePath;
    }
    case "polygon": {
      return parsePolygon;
    }
    case "circle": {
      return parseCircle;
    }
    case "hstore": {
      return parseHstore;
    }
    case "jsonb":
    case "json":
    case "bigint":
    case "money":
    case "numeric":
    case "date":
    case "timestamp":
    case "timestamptz":
    case "time":
    case "timetz":
    case "inet":
    case "regdictionary":
    case "regconfig":
    case "regnamespace":
    case "regrole":
    case "regtype":
    case "regclass":
    case "regoper":
    case "regoperator":
    case "regproc":
    case "regprocedure":
    case "bit":
    case "varbit":
    case "cidr":
    case "macaddr":
    case "macaddr8":
    case "char":
    case "varchar":
    case "citext":
    case "uuid":
    case "text": {
      return identity;
    }
    default: {
      const never: never = type;
      console.warn(`No pg2gqlForType handler for '${never}'`);
      return identity;
    }
  }
};

const gql2pgForType = (type: SupportedPostgresType): PgEncode<any> => {
  switch (type) {
    case "interval": {
      return stringifyInterval;
    }
    case "point": {
      return stringifyPoint;
    }
    case "line": {
      return stringifyLine;
    }
    case "lseg": {
      return stringifyLseg;
    }
    case "box": {
      return stringifyBox;
    }
    case "path": {
      return stringifyPath;
    }
    case "polygon": {
      return stringifyPolygon;
    }
    case "circle": {
      return stringifyCircle;
    }
    case "hstore": {
      return stringifyHstore;
    }
    case "int2":
    case "int4":
    case "float":
    case "float4":
    case "bool":
    case "jsonb":
    case "json":
    case "bigint":
    case "money":
    case "numeric":
    case "date":
    case "timestamp":
    case "timestamptz":
    case "time":
    case "timetz":
    case "inet":
    case "regdictionary":
    case "regconfig":
    case "regnamespace":
    case "regrole":
    case "regtype":
    case "regclass":
    case "regoper":
    case "regoperator":
    case "regproc":
    case "regprocedure":
    case "bit":
    case "varbit":
    case "cidr":
    case "macaddr":
    case "macaddr8":
    case "char":
    case "varchar":
    case "citext":
    case "uuid":
    case "text": {
      return identity;
    }
    default: {
      const never: never = type;
      console.warn(`No gql2pgForType handler for '${never}'`);
      return identity;
    }
  }
};

function t<TCanonical = any, TInput = TCanonical>(
  type: SupportedPostgresType,
): PgTypeCodec<undefined, TCanonical, TInput> {
  return {
    sqlType: sql.identifier(...type.split(".")),
    fromPg: pg2gqlForType(type),
    toPg: gql2pgForType(type),
    columns: undefined,
    extensions: undefined,
  };
}

export function recordType<TColumns extends PgSourceColumns>(
  identifier: SQL,
  columns: TColumns,
  extensions?: Partial<PgTypeCodecExtensions>,
): PgTypeCodec<TColumns, string, string> {
  return {
    sqlType: identifier,
    fromPg: identity,
    toPg: identity,
    columns,
    extensions,
  };
}
exportAs(recordType, "recordType");

export function enumType<TValue extends string>(
  identifier: SQL,
  values: TValue[],
  extensions?: Partial<PgTypeCodecExtensions>,
): PgEnumTypeCodec<TValue> {
  return {
    sqlType: identifier,
    fromPg: identity,
    toPg: identity,
    values,
    columns: undefined,
    extensions,
  };
}
exportAs(enumType, "enumType");

export function listOfType<TInnerType extends PgTypeCodec<any, any>>(
  innerType: TInnerType,
  extensions?: Partial<PgTypeCodecExtensions>,
  identifier: SQL = sql`${innerType.sqlType}[]`,
): PgTypeCodec<
  undefined, // Array has no columns
  TInnerType extends PgTypeCodec<any, infer U, any> ? U[] : any[],
  TInnerType extends PgTypeCodec<any, any, infer U> ? U[] : any[]
> {
  if (innerType.isArray) {
    throw new Error("Array types cannot be nested");
  }
  return {
    sqlType: identifier,
    // TODO: this does __NOT__ handle nulls safely!
    fromPg: (value) =>
      arrayParse(value)
        .flat(100)
        .map((v) => innerType.fromPg(v)) as any,
    // TODO: this does __NOT__ handle nulls safely!
    toPg: (value) => (value ? value.map((v) => innerType.toPg(v)) : null),
    columns: undefined,
    extensions,
    isArray: true,
  };
}

export const TYPES = {
  boolean: t<boolean>("bool"),
  int2: t<number>("int2"),
  int: t<number>("int4"),
  bigint: t<string>("bigint"),
  float4: t<number>("float4"),
  float: t<number>("float"),
  money: t<string>("money"), // TODO: this needs special formatting/parsing? Cast to 'numeric'?
  numeric: t<string>("numeric"),
  char: t<string>("char"),
  varchar: t<string>("varchar"),
  text: t<string>("text"),
  json: t<string>("json"),
  jsonb: t<string>("jsonb"),
  citext: t<string>("citext"),
  uuid: t<string>("uuid"),
  timestamp: t<Date, Date | string>("timestamp"),
  timestamptz: t<Date, Date | string>("timestamptz"),
  date: t<Date, Date | string>("date"),
  time: t<string>("time"),
  timetz: t<string>("timetz"),
  inet: t<string>("inet"),
  regproc: t<string>("regproc"),
  regprocedure: t<string>("regprocedure"),
  regoper: t<string>("regoper"),
  regoperator: t<string>("regoperator"),
  regclass: t<string>("regclass"),
  regtype: t<string>("regtype"),
  regrole: t<string>("regrole"),
  regnamespace: t<string>("regnamespace"),
  regconfig: t<string>("regconfig"),
  regdictionary: t<string>("regdictionary"),
  cidr: t<string>("cidr"),
  macaddr: t<string>("macaddr"),
  macaddr8: t<string>("macaddr8"),
  interval: t<PgInterval, string>("interval"),
  bit: t<string>("bit"),
  varbit: t<string>("varbit"),
  point: t<PgPoint, string>("point"),
  line: t<PgLine, string>("line"),
  lseg: t<PgLseg, string>("lseg"),
  box: t<PgBox, string>("box"),
  path: t<PgPath, string>("path"),
  polygon: t<PgPolygon, string>("polygon"),
  circle: t<PgCircle, string>("circle"),
  hstore: t<PgHStore, string>("hstore"),
} as const;
exportAs(TYPES, "TYPES");
for (const key of Object.keys(TYPES)) {
  exportAs(TYPES[key], ["TYPES", key]);
}
