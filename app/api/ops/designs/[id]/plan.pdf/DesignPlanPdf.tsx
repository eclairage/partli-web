import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";

// A single item's data, with images pre-resolved to data URIs by the route.
export type PlanItem = {
  item_type: string;
  existing_data_uri: string | null;
  new_data_uri: string | null;
  new_name: string | null;
  new_finish: string | null;
  new_url: string | null;
  new_notes: string | null;
  new_vendor_name: string | null;
  new_vendor_price_cents: number | null;
};

export type DesignPlanProps = {
  projectTitle: string;
  homeownerName: string | null;
  address: string | null;
  scopeSummary: string | null;
  fixedPriceCents: number | null;
  items: PlanItem[];
  internal: boolean;
  generatedAt: string;
};

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

const PARTLI_INK = "#10161F";
const PARTLI_ACCENT = "#007889";
const SLATE = "#64748b";
const BORDER = "#e2e8f0";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 44, fontSize: 10, color: PARTLI_INK },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 4 },
  brand: { fontSize: 16, fontWeight: 700, color: PARTLI_INK },
  brandNote: { fontSize: 9, color: SLATE },
  title: { fontSize: 20, fontWeight: 700, marginTop: 14 },
  meta: { fontSize: 10, color: SLATE, marginTop: 2 },
  priceBox: {
    marginTop: 14,
    marginBottom: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceLabel: { fontSize: 10, color: SLATE, textTransform: "uppercase", letterSpacing: 1 },
  priceValue: { fontSize: 20, fontWeight: 700, color: PARTLI_INK },
  scope: { fontSize: 10, color: "#334155", marginTop: 8, marginBottom: 8, lineHeight: 1.4 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: PARTLI_ACCENT,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  item: { borderWidth: 1, borderColor: BORDER, borderRadius: 6, padding: 10, marginBottom: 10 },
  itemType: { fontSize: 12, fontWeight: 700, marginBottom: 6 },
  cols: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  colLabel: { fontSize: 8, color: SLATE, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 },
  img: {
    width: "100%",
    height: 170,
    objectFit: "contain",
    backgroundColor: "#f8fafc",
    borderRadius: 4,
    marginBottom: 4,
  },
  imgPlaceholder: {
    width: "100%",
    height: 170,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  placeholderText: { fontSize: 8, color: SLATE },
  field: { flexDirection: "row", marginTop: 2 },
  fieldLabel: { fontSize: 9, color: SLATE, width: 44 },
  fieldValue: { fontSize: 9, color: PARTLI_INK, flex: 1 },
  name: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 8,
    color: SLATE,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
});

export default function DesignPlanPdf({
  projectTitle,
  homeownerName,
  address,
  scopeSummary,
  fixedPriceCents,
  items,
  internal,
  generatedAt,
}: DesignPlanProps) {
  const internalCost = items.reduce((sum, it) => sum + (it.new_vendor_price_cents || 0), 0);

  return (
    <Document>
      <Page size="LETTER" style={s.page} wrap>
        <View style={s.brandRow}>
          <Text style={s.brand}>partli</Text>
          <Text style={s.brandNote}>
            Design Plan{internal ? " · INTERNAL COPY" : ""}
          </Text>
        </View>

        <Text style={s.title}>{projectTitle || "Bathroom Design Plan"}</Text>
        <Text style={s.meta}>
          {[homeownerName, address].filter(Boolean).join(" · ") || "—"}
        </Text>

        <View style={s.priceBox}>
          <Text style={s.priceLabel}>All-in fixed price</Text>
          <Text style={s.priceValue}>{money(fixedPriceCents)}</Text>
        </View>

        {internal && (
          <Text style={s.meta}>
            Internal vendor-cost total: {money(internalCost)} (not shown on the homeowner copy)
          </Text>
        )}

        {scopeSummary ? <Text style={s.scope}>{scopeSummary}</Text> : null}

        <Text style={s.sectionHeading}>Items — existing → replacement</Text>

        {items.map((it, i) => (
          <View key={i} style={s.item} wrap={false}>
            <Text style={s.itemType}>{it.item_type || "Item"}</Text>
            <View style={s.cols}>
              {/* Existing */}
              <View style={s.col}>
                <Text style={s.colLabel}>Existing</Text>
                {it.existing_data_uri ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image style={s.img} src={it.existing_data_uri} />
                ) : (
                  <View style={s.imgPlaceholder}>
                    <Text style={s.placeholderText}>No photo</Text>
                  </View>
                )}
              </View>
              {/* New */}
              <View style={s.col}>
                <Text style={s.colLabel}>New</Text>
                {it.new_data_uri ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image style={s.img} src={it.new_data_uri} />
                ) : (
                  <View style={s.imgPlaceholder}>
                    <Text style={s.placeholderText}>No image</Text>
                  </View>
                )}
                {it.new_name ? <Text style={s.name}>{it.new_name}</Text> : null}
                {it.new_finish ? (
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Finish</Text>
                    <Text style={s.fieldValue}>{it.new_finish}</Text>
                  </View>
                ) : null}
                {internal && it.new_vendor_name ? (
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Vendor</Text>
                    <Text style={s.fieldValue}>{it.new_vendor_name}</Text>
                  </View>
                ) : null}
                {internal && it.new_vendor_price_cents != null ? (
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Price</Text>
                    <Text style={s.fieldValue}>{money(it.new_vendor_price_cents)}</Text>
                  </View>
                ) : null}
                {it.new_url ? (
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Link</Text>
                    <Text style={s.fieldValue}>{it.new_url}</Text>
                  </View>
                ) : null}
                {it.new_notes ? (
                  <View style={s.field}>
                    <Text style={s.fieldLabel}>Notes</Text>
                    <Text style={s.fieldValue}>{it.new_notes}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}

        {items.length === 0 && (
          <Text style={s.scope}>No items have been added to this design yet.</Text>
        )}

        <Text style={s.footer} fixed>
          Partli · Generated {generatedAt}
          {internal ? " · Internal — do not share with homeowner" : ""}
        </Text>
      </Page>
    </Document>
  );
}
