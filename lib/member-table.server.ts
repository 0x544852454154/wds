import "server-only";

/**
 * The member table.
 *
 * Discord snowflake IDs are confidential-by-omission: this module is
 * `server-only`, and nothing under `app/` or `components/` may import it.
 * Members are addressed publicly by the integer index derived here.
 */
export interface MemberRow {
  id: string;
  fallbackName: string;
  role: string;
}

export interface RoleRow {
  name: string;
  members: MemberRow[];
}

const ROLES: RoleRow[] = [
  {
    name: "Unbothered",
    members: [{ id: "1403234492419670038", fallbackName: "ivenflyestasian", role: "Unbothered" }],
  },
  {
    name: "$moke after $ex",
    members: [
      { id: "1521890728094208122", fallbackName: "eunsoulja", role: "$moke after $ex" },
      { id: "1524801139227361403", fallbackName: "killwxre", role: "$moke after $ex" },
      { id: "1472259759708180490", fallbackName: "swagalicioux", role: "$moke after $ex" },
      { id: "1335221585652613130", fallbackName: "stanlost", role: "$moke after $ex" },
      { id: "1421495070590369812", fallbackName: "6ixqt", role: "$moke after $ex" },
      { id: "777366679775608862", fallbackName: "g1y7", role: "$moke after $ex" },
      { id: "254741319551942657", fallbackName: "a0fw", role: "$moke after $ex" },
      { id: "1354785005565640847", fallbackName: "cozyrico", role: "$moke after $ex" },
      { id: "1255129520579805224", fallbackName: "compxte", role: "$moke after $ex" },
    ],
  },
  {
    name: "WALANG SINASANTO",
    members: [
      { id: "1439151115965960242", fallbackName: "daarthnullx", role: "WALANG SINASANTO" },
      { id: "689721147368931387", fallbackName: "htrbpolo", role: "WALANG SINASANTO" },
      {
        id: "1232466859664740453",
        fallbackName: "ziasdaiadioajgia_knandanugada",
        role: "WALANG SINASANTO",
      },
      { id: "1059905807090733117", fallbackName: "sippinbottles", role: "WALANG SINASANTO" },
      { id: "1437419986808213545", fallbackName: "stubxrn.", role: "WALANG SINASANTO" },
    ],
  },
];

export const MEMBER_ROWS: MemberRow[] = ROLES.flatMap((group) => group.members);

export const MEMBER_IDS: string[] = MEMBER_ROWS.map((m) => m.id);

const INDEX_BY_ID = new Map<string, number>(MEMBER_IDS.map((id, index) => [id, index]));

/** Public roster shape: index plus display fallback only, never the ID. */
export function publicGroups(): Array<{ name: string; slots: Array<{ index: number; fallbackName: string }> }> {
  let cursor = 0;
  return ROLES.map((group) => ({
    name: group.name,
    slots: group.members.map((member) => {
      const index = cursor++;
      return { index, fallbackName: member.fallbackName };
    }),
  }));
}

export function publicRoleOf(index: number): string {
  return MEMBER_ROWS[index]?.role ?? "";
}

export function publicFallbackOf(index: number): string {
  return MEMBER_ROWS[index]?.fallbackName ?? "";
}

export function resolveIndex(id: string): number | undefined {
  return INDEX_BY_ID.get(id);
}