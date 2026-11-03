import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ReportCard } from "../reportcard";

const C = { ink: "#550605", gold: "#D8A93D", line: "#D6CCA9", mute: "#6F5F3F", paper: "#F3EEDB" };
const s = StyleSheet.create({
  page: { padding: 34, fontSize: 10, color: "#2E0907", fontFamily: "Helvetica" },
  head: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 3, borderBottomColor: C.ink, paddingBottom: 8, marginBottom: 12 },
  h1: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.ink },
  mute: { color: C.mute },
  photo: { width: 66, height: 82, borderWidth: 1, borderColor: C.line, objectFit: "cover" },
  metaWrap: { flexDirection: "row", marginBottom: 12 },
  meta: { flexDirection: "row", marginBottom: 3 },
  metaL: { width: 70, color: C.mute },
  th: { flexDirection: "row", backgroundColor: C.ink, color: "#FBF7EA", paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 5, paddingHorizontal: 6 },
  c1: { flex: 3 }, c2: { flex: 1, textAlign: "right" }, c3: { flex: 1, paddingLeft: 10 }, c4: { flex: 1.2, textAlign: "right" }, c5: { flex: 0.8, textAlign: "right" }, c6: { flex: 2, paddingLeft: 10 },
  sum: { flexDirection: "row", marginTop: 12 },
  sumBox: { flex: 1, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper, padding: 8 },
  sumV: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2, color: C.ink },
  box: { marginTop: 12, borderWidth: 1, borderColor: C.line, padding: 8, minHeight: 46 },
  sig: { flexDirection: "row", marginTop: 34 },
  sigC: { flex: 1, borderTopWidth: 1, borderTopColor: "#2E0907", marginRight: 16, paddingTop: 4 },
});

export function ReportCardPage({ d }: { d: ReportCard }) {
  const st = d.student;
  return (
    <Page size="A4" style={s.page}>
      <View style={s.head}>
        <View>
          <Text style={s.h1}>{process.env.SCHOOL_NAME ?? "School"}</Text>
          <Text style={s.mute}>Report card · {d.term.year} · {d.term.termName} · {d.examType}</Text>
        </View>
        {st.photoUrl ? <Image src={st.photoUrl} style={s.photo} /> : null}
      </View>
      <View style={s.metaWrap}>
        <View style={{ flex: 1 }}>
          <View style={s.meta}><Text style={s.metaL}>Name</Text><Text>{st.firstName} {st.lastName}</Text></View>
          <View style={s.meta}><Text style={s.metaL}>Adm. no.</Text><Text>{st.admissionNumber}</Text></View>
          <View style={s.meta}><Text style={s.metaL}>Class</Text><Text>{st.className} {st.stream ?? ""}</Text></View>
          <View style={s.meta}><Text style={s.metaL}>Position</Text><Text>{d.position ? `${d.position} of ${d.outOf}` : "-"}</Text></View>
        </View>
      </View>

      <View style={s.th}>
        <Text style={s.c1}>Subject</Text><Text style={s.c2}>Marks</Text><Text style={s.c3}>Grade</Text>
        <Text style={s.c4}>Class mean</Text><Text style={s.c5}>Rank</Text><Text style={s.c6}>Remarks</Text>
      </View>
      {d.rows.length === 0 && <View style={s.tr}><Text style={s.mute}>No results have been entered for this exam yet.</Text></View>}
      {d.rows.map((r) => (
        <View key={r.subject} style={s.tr}>
          <Text style={s.c1}>{r.subject}</Text><Text style={s.c2}>{r.marks.toFixed(1)}</Text><Text style={s.c3}>{r.grade}</Text>
          <Text style={s.c4}>{r.mean}</Text><Text style={s.c5}>{r.rank ?? ""}</Text><Text style={s.c6}>{r.remarks}</Text>
        </View>
      ))}

      <View style={s.sum}>
        <View style={s.sumBox}><Text style={s.mute}>Total marks</Text><Text style={s.sumV}>{d.total.toFixed(1)}</Text></View>
        <View style={s.sumBox}><Text style={s.mute}>Mean score</Text><Text style={s.sumV}>{d.mean}</Text></View>
        <View style={s.sumBox}><Text style={s.mute}>Mean grade</Text><Text style={s.sumV}>{d.meanGrade}</Text></View>
        <View style={s.sumBox}><Text style={s.mute}>Fee balance</Text><Text style={s.sumV}>{d.balance === null ? "-" : "KES " + d.balance.toLocaleString("en-KE")}</Text></View>
      </View>
      <View style={s.box}><Text style={s.mute}>Class teacher's comments</Text></View>
      <View style={s.box}><Text style={s.mute}>Principal's comments</Text></View>
      <View style={s.sig}><Text style={s.sigC}>Class teacher</Text><Text style={s.sigC}>Principal</Text><Text style={s.sigC}>Parent / guardian</Text></View>
    </Page>
  );
}

export const ReportCardDoc = ({ d }: { d: ReportCard }) => <Document title={`Report card ${d.student.admissionNumber}`}><ReportCardPage d={d} /></Document>;
export const ReportCardsDoc = ({ cards }: { cards: ReportCard[] }) => <Document title="Report cards">{cards.map((d) => <ReportCardPage key={d.student.id} d={d} />)}</Document>;

export function FeeStructureDoc(p: { className: string; term: string; year: number; fees: { head: string; due: string; amount: string }[]; admission: string }) {
  const total = p.fees.reduce((x, f) => x + Number(f.amount), 0);
  return (
    <Document title="Fee structure">
      <Page size="A4" style={s.page}>
        <View style={s.head}><View>
          <Text style={s.h1}>{process.env.SCHOOL_NAME ?? "School"} · Fee structure</Text>
          <Text style={s.mute}>{p.className} · {p.year} {p.term}</Text></View></View>
        <View style={s.th}><Text style={s.c1}>Fee</Text><Text style={s.c3}>Due</Text><Text style={s.c2}>Amount (KES)</Text></View>
        {p.fees.map((f) => (
          <View key={f.head} style={s.tr}><Text style={s.c1}>{f.head}</Text><Text style={s.c3}>{f.due}</Text><Text style={s.c2}>{Number(f.amount).toLocaleString("en-KE", { minimumFractionDigits: 2 })}</Text></View>
        ))}
        <View style={s.tr}><Text style={[s.c1, { fontFamily: "Helvetica-Bold" }]}>Total</Text><Text style={s.c3} /><Text style={[s.c2, { fontFamily: "Helvetica-Bold" }]}>{total.toLocaleString("en-KE", { minimumFractionDigits: 2 })}</Text></View>
        <Text style={[s.mute, { marginTop: 18 }]}>Pay by M-Pesa Paybill {process.env.MPESA_SHORTCODE}, account number {p.admission}.</Text>
      </Page>
    </Document>
  );
}
