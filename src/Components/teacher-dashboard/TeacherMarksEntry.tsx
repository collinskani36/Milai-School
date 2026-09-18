import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { Card, CardContent } from "@/Components/ui/card";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/Components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/Components/ui/table";
import { Badge } from "@/Components/ui/badge";
import {
  AlertTriangle, CheckCircle, Save, Loader2, BookOpen, ClipboardList,
  Plus, ArrowLeft, History, Pencil,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// ─── Design tokens ────────────────────────────────────────────────────────────
const MAROON = "#7a1f2b";
const MAROON_GRADIENT = "linear-gradient(135deg, #7a1f2b 0%, #5f1620 60%, #4a1119 100%)";
const CARD_SHADOW = "0 6px 26px -18px rgba(122,31,43,0.22)";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TeacherClass {
  id: string; teacher_id: string; class_id: string; subject_id: string;
  classes?:  | { id: string; name: string; grade_level: string } | { id: string; name: string; grade_level: string }[];
  subjects?: | { id: string; name: string; code: string }        | { id: string; name: string; code: string }[];
}

interface SummativeAssessment {
  id: string; title: string; term: number; year: number;
  class_id: string; max_marks: number; assessment_date: string | null;
}

interface FormativeActivity {
  id: string; title: string; description: string | null;
  term: number; year: number; class_id: string; subject_id: string;
  strand_id: string | null; sub_strand_id: string | null;
  activity_date: string; teacher_id: string;
  strands?:     { id: string; name: string } | null;
  sub_strands?: { id: string; name: string } | null;
}

interface Student { id: string; Reg_no: string; first_name: string; last_name: string; }
interface StrandRow    { id: string; name: string; code: string; subject_id: string; }
interface SubStrandRow { id: string; name: string; code: string; strand_id: string; }

interface HistoryItem {
  type: "summative" | "formative";
  key: string;
  title: string; term: number; year: number;
  class_id: string; subject_id: string; subject_name: string;
  strand_name: string | null; sub_strand_name: string | null;
  result_count: number; latest_date: string | null;
  status: "draft" | "published";
  summativeAssessment?: SummativeAssessment;
  formativeActivity?: FormativeActivity;
}

type PerformanceLevel = "EE" | "ME" | "AE" | "BE";
type Mode = "summative" | "formative" | "history";

interface SummativeEntry { score: string; performance_level: PerformanceLevel | null; teacher_remarks: string; is_absent: boolean; date: string; }
interface FormativeEntry { performance_level: PerformanceLevel | null; teacher_comment: string; is_absent: boolean; }

// ─── Constants & helpers (UNCHANGED) ──────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const CURRENT_TERM = (() => { const m = new Date().getMonth()+1; return m<=4?1:m<=8?2:3; })();
const LEVELS: PerformanceLevel[] = ["EE","ME","AE","BE"];
const today = () => new Date().toISOString().slice(0,10);
const firstRel = <T,>(r?: T|T[]|null): T|undefined => !r ? undefined : Array.isArray(r) ? r[0] : r as T;
const perfLevel = (score: number, max: number): PerformanceLevel => {
  const p = (score/max)*100;
  return p>=75?"EE":p>=50?"ME":p>=25?"AE":"BE";
};

// ─── Section header (maroon gradient) ─────────────────────────────────────────
function SectionHeader({
  icon: Icon, title, subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-t-2xl px-4 sm:px-5 py-3.5 shrink-0"
      style={{ background: MAROON_GRADIENT }}
    >
      <div
        className="absolute -top-16 -right-8 w-48 h-48 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.14), transparent 70%)" }}
      />
      <div
        className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08), transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-white font-bold text-sm sm:text-base leading-tight truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="text-white/70 text-[11px] leading-tight truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── UI components ────────────────────────────────────────────────────────────

const LEVEL_STYLES: Record<PerformanceLevel,string> = {
  EE:"bg-green-100 border-green-300 text-green-800",
  ME:"bg-blue-100 border-blue-300 text-blue-800",
  AE:"bg-yellow-100 border-yellow-300 text-yellow-800",
  BE:"bg-red-100 border-red-300 text-red-800",
};

function PerfBadge({ level }: { level: PerformanceLevel }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-semibold ${LEVEL_STYLES[level]}`}>{level}</span>;
}

function LevelToggle({ value, onChange, disabled }: { value: PerformanceLevel|null; onChange:(l:PerformanceLevel)=>void; disabled:boolean }) {
  return (
    <div className="flex gap-1">
      {LEVELS.map(l => (
        <button key={l} type="button" onClick={()=>onChange(l)} disabled={disabled}
          className={`px-2 py-1 rounded-lg border text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            value===l
              ? `${LEVEL_STYLES[l]} shadow-sm`
              : "bg-white border-[#7a1f2b]/15 text-[#7a1f2b]/40 hover:border-[#7a1f2b]/40 hover:text-[#7a1f2b]/70"
          }`}>
          {l}
        </button>
      ))}
    </div>
  );
}

function StrandSelect({ subjectId, value, onChange, disabled }: { subjectId:string; value:string; onChange:(id:string,name:string)=>void; disabled:boolean }) {
  const [strands,  setStrands]  = useState<StrandRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [creating, setCreating] = useState(false);
  const [err,      setErr]      = useState<string|null>(null);

  useEffect(() => {
    if (!subjectId) { setStrands([]); return; }
    setLoading(true);
    supabase.from("strands").select("id,name,code,subject_id").eq("subject_id",subjectId).order("name")
      .then(({data}) => { setStrands(data??[]); setLoading(false); });
  }, [subjectId]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true); setErr(null);
    const code = newName.trim().slice(0,20).toUpperCase().replace(/\s+/g,"_");
    const {data,error} = await supabase.from("strands").insert({subject_id:subjectId,name:newName.trim(),code}).select("id,name,code,subject_id").single();
    if (error) { setErr(error.message); setCreating(false); return; }
    setStrands(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    onChange(data.id,data.name);
    setNewName(""); setShowNew(false); setCreating(false);
  };

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={v=>{ if(v==="__new__"){setShowNew(true);return;} onChange(v,v==="__none__"?"":(strands.find(s=>s.id===v)?.name??"")); }} disabled={disabled||loading}>
        <SelectTrigger className="h-9 rounded-xl border-[#7a1f2b]/15">
          <SelectValue placeholder={loading?"Loading…":"Select strand (optional)"}/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— No strand —</SelectItem>
          {strands.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          <SelectItem value="__new__" className="text-[#7a1f2b] font-medium">
            <span className="flex items-center gap-1"><Plus className="h-3 w-3"/>Add new strand…</span>
          </SelectItem>
        </SelectContent>
      </Select>
      {showNew && (
        <div className="flex gap-2">
          <Input placeholder="New strand name" value={newName} onChange={e=>setNewName(e.target.value)} className="h-8 text-sm rounded-lg border-[#7a1f2b]/15" onKeyDown={e=>e.key==="Enter"&&create()}/>
          <Button size="sm" className="h-8 shrink-0 text-white hover:opacity-90 rounded-lg" style={{background: MAROON_GRADIENT}} onClick={create} disabled={creating||!newName.trim()}>
            {creating?<Loader2 className="h-3 w-3 animate-spin"/>:"Add"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={()=>{setShowNew(false);setNewName("");}}>✕</Button>
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

function SubStrandSelect({ strandId, value, onChange, disabled }: { strandId:string; value:string; onChange:(id:string,name:string)=>void; disabled:boolean }) {
  const [subs,     setSubs]     = useState<SubStrandRow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [newName,  setNewName]  = useState("");
  const [creating, setCreating] = useState(false);
  const [err,      setErr]      = useState<string|null>(null);

  useEffect(() => {
    if (!strandId||strandId==="__none__") { setSubs([]); return; }
    setLoading(true);
    supabase.from("sub_strands").select("id,name,code,strand_id").eq("strand_id",strandId).order("name")
      .then(({data}) => { setSubs(data??[]); setLoading(false); });
  }, [strandId]);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true); setErr(null);
    const code = newName.trim().slice(0,20).toUpperCase().replace(/\s+/g,"_");
    const {data,error} = await supabase.from("sub_strands").insert({strand_id:strandId,name:newName.trim(),code}).select("id,name,code,strand_id").single();
    if (error) { setErr(error.message); setCreating(false); return; }
    setSubs(prev=>[...prev,data].sort((a,b)=>a.name.localeCompare(b.name)));
    onChange(data.id,data.name);
    setNewName(""); setShowNew(false); setCreating(false);
  };

  if (!strandId||strandId==="__none__") return null;

  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={v=>{ if(v==="__new__"){setShowNew(true);return;} onChange(v,v==="__none__"?"":(subs.find(s=>s.id===v)?.name??"")); }} disabled={disabled||loading}>
        <SelectTrigger className="h-9 rounded-xl border-[#7a1f2b]/15">
          <SelectValue placeholder={loading?"Loading…":"Select sub-strand (optional)"}/>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">— No sub-strand —</SelectItem>
          {subs.map(s=><SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          <SelectItem value="__new__" className="text-[#7a1f2b] font-medium">
            <span className="flex items-center gap-1"><Plus className="h-3 w-3"/>Add new sub-strand…</span>
          </SelectItem>
        </SelectContent>
      </Select>
      {showNew && (
        <div className="flex gap-2">
          <Input placeholder="New sub-strand name" value={newName} onChange={e=>setNewName(e.target.value)} className="h-8 text-sm rounded-lg border-[#7a1f2b]/15" onKeyDown={e=>e.key==="Enter"&&create()}/>
          <Button size="sm" className="h-8 shrink-0 text-white hover:opacity-90 rounded-lg" style={{background: MAROON_GRADIENT}} onClick={create} disabled={creating||!newName.trim()}>
            {creating?<Loader2 className="h-3 w-3 animate-spin"/>:"Add"}
          </Button>
          <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={()=>{setShowNew(false);setNewName("");}}>✕</Button>
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

const ScoreInput = memo(({value,studentId,maxMarks,disabled,onChange}:{value:string;studentId:string;maxMarks:number;disabled:boolean;onChange:(id:string,v:string)=>void}) => (
  <Input type="number" step="0.01" min="0" max={maxMarks} value={value} onChange={e=>onChange(studentId,e.target.value)} className="w-24 rounded-lg border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" disabled={disabled} placeholder="0"/>
));
ScoreInput.displayName = "ScoreInput";

const TextInput = memo(({value,studentId,placeholder,disabled,onChange}:{value:string;studentId:string;placeholder:string;disabled:boolean;onChange:(id:string,v:string)=>void}) => (
  <Input type="text" placeholder={placeholder} value={value} onChange={e=>onChange(studentId,e.target.value)} className="w-full text-sm rounded-lg border-[#7a1f2b]/15 focus-visible:ring-[#7a1f2b]/30" disabled={disabled}/>
));
TextInput.displayName = "TextInput";

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TeacherMarksEntry({ teacherId, teacherClasses, academicYear, assessmentYear, currentTerm }:
  { teacherId:string; teacherClasses:TeacherClass[]; academicYear?:string; assessmentYear?:number; currentTerm?:number }) {

  const [mode, setMode] = useState<Mode>("summative");

  // Summative
  const [summativeList,         setSummativeList]         = useState<SummativeAssessment[]>([]);
  const [selectedAssessmentId,  setSelectedAssessmentId]  = useState("");
  const [selectedAssessment,    setSelectedAssessment]    = useState<SummativeAssessment|null>(null);
  const [selectedSubjectId,     setSelectedSubjectId]     = useState("");
  const [loadingAssessments,    setLoadingAssessments]    = useState(false);

  // Formative creation
  const [fClassId,      setFClassId]      = useState("");
  const [fSubjectId,    setFSubjectId]    = useState("");
  const [fTitle,        setFTitle]        = useState("");
  const [fDesc,         setFDesc]         = useState("");
  const [fStrandId,     setFStrandId]     = useState("__none__");
  const [fStrandName,   setFStrandName]   = useState("");
  const [fSubStrandId,  setFSubStrandId]  = useState("__none__");
  const [fSubStrandName,setFSubStrandName]= useState("");
  const [fDate,         setFDate]         = useState(today());
  const [fTerm,         setFTerm]         = useState(String(currentTerm??CURRENT_TERM));
  const [fYear,         setFYear]         = useState(String(assessmentYear??CURRENT_YEAR));
  const [creating,      setCreating]      = useState(false);
  const [createErr,     setCreateErr]     = useState<string|null>(null);
  const [activeActivity,setActiveActivity]= useState<FormativeActivity|null>(null);

  // History
  const [history,        setHistory]        = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [histFilter,     setHistFilter]     = useState<"all"|"formative"|"summative">("all");
  const [editingItem,    setEditingItem]    = useState<HistoryItem|null>(null);

  // Shared marks
  const [students,         setStudents]         = useState<Student[]>([]);
  const [summativeEntries, setSummativeEntries] = useState<Record<string,SummativeEntry>>({});
  const [formativeEntries, setFormativeEntries] = useState<Record<string,FormativeEntry>>({});
  const [loadingData,      setLoadingData]      = useState(false);
  const [saving,           setSaving]           = useState(false);
  const [error,            setError]            = useState<string|null>(null);
  const [success,          setSuccess]          = useState<string|null>(null);

  const isMounted = useRef(true);
  useEffect(()=>{ isMounted.current=true; return()=>{ isMounted.current=false; }; },[]);

  const classIds = useMemo(()=>[...new Set(teacherClasses.map(tc=>tc.class_id))],[teacherClasses]);

  const classNameMap = useMemo(()=>{
    const m=new Map<string,string>();
    teacherClasses.forEach(tc=>{ const c=firstRel(tc.classes); if(c?.name) m.set(tc.class_id,c.name); });
    return m;
  },[teacherClasses]);

  const uniqueClasses = useMemo(()=>{
    const seen=new Set<string>();
    return teacherClasses.filter(tc=>{ if(seen.has(tc.class_id)) return false; seen.add(tc.class_id); return true; });
  },[teacherClasses]);

  const fSubjects = useMemo(()=>teacherClasses.filter(tc=>tc.class_id===fClassId),[teacherClasses,fClassId]);

  const availableSubjects = useMemo(()=>{
    if (!selectedAssessment) return [];
    return teacherClasses.filter(tc=>tc.class_id===selectedAssessment.class_id&&!!firstRel(tc.subjects)?.name);
  },[teacherClasses,selectedAssessment]);

  const subjectNameMap = useMemo(()=>new Map(teacherClasses.map(tc=>[tc.subject_id,firstRel(tc.subjects)?.name??tc.subject_id])),[teacherClasses]);

  // Load summative assessments
  useEffect(()=>{
    if (!classIds.length) return;
    setLoadingAssessments(true);
    supabase.from("assessments")
      .select("id,title,term,year,class_id,max_marks,assessment_date")
      .in("class_id",classIds).eq("category","summative")
      .eq("term",currentTerm??CURRENT_TERM).eq("year",assessmentYear??CURRENT_YEAR)
      .order("title")
      .then(({data,error:err})=>{
        if (!isMounted.current) return;
        if (err) setError("Failed to load assessments");
        else setSummativeList(data??[]);
        setLoadingAssessments(false);
      });
  },[classIds,currentTerm,assessmentYear]);

  // Load students for a class
  const loadStudents = useCallback(async (classId:string):Promise<Student[]>=>{
    const {data,error:err} = await supabase.from("enrollments")
      .select("student_id, students!inner(id,Reg_no,first_name,last_name)").eq("class_id",classId);
    if (err||!data) return [];
    return data.map(e=>firstRel(e.students)).filter((s):s is Student=>!!s);
  },[]);

  // Load summative data
  const loadSummativeData = useCallback(async (asm:SummativeAssessment, subjectId:string)=>{
    setLoadingData(true); setError(null);
    const [studentList, {data:results,error:rErr}] = await Promise.all([
      loadStudents(asm.class_id),
      supabase.from("assessment_results")
        .select("student_id,score,performance_level,teacher_remarks,is_absent,assessment_date")
        .eq("assessment_id",asm.id).eq("subject_id",subjectId),
    ]);
    if (!isMounted.current) return;
    if (rErr) { setError("Failed to load results."); setLoadingData(false); return; }
    const map:Record<string,typeof results[0]>={};
    (results??[]).forEach(r=>{ map[r.student_id]=r; });
    const fb = asm.assessment_date||today();
    const init:Record<string,SummativeEntry>={};
    studentList.forEach(s=>{
      const ex=map[s.id];
      init[s.id]={
        score:             ex?String(ex.score):"",
        performance_level: (ex?.performance_level as PerformanceLevel|null)??null,
        teacher_remarks:   ex?.teacher_remarks??"",
        is_absent:         ex?.is_absent??false,
        date:              ex?.assessment_date?String(ex.assessment_date).slice(0,10):fb,
      };
    });
    setStudents(studentList); setSummativeEntries(init); setLoadingData(false);
  },[loadStudents]);

  // Load formative data
  const loadFormativeData = useCallback(async (activity:FormativeActivity)=>{
    setLoadingData(true); setError(null);
    const [studentList, {data:results,error:rErr}] = await Promise.all([
      loadStudents(activity.class_id),
      supabase.from("formative_results")
        .select("student_id,performance_level,is_absent,teacher_comment")
        .eq("formative_activity_id",activity.id),
    ]);
    if (!isMounted.current) return;
    if (rErr) { setError("Failed to load results."); setLoadingData(false); return; }
    const map:Record<string,typeof results[0]>={};
    (results??[]).forEach(r=>{ map[r.student_id]=r; });
    const init:Record<string,FormativeEntry>={};
    studentList.forEach(s=>{
      const ex=map[s.id];
      init[s.id]={ performance_level:(ex?.performance_level as PerformanceLevel|null)??null, teacher_comment:ex?.teacher_comment??"", is_absent:ex?.is_absent??false };
    });
    setStudents(studentList); setFormativeEntries(init); setLoadingData(false);
  },[loadStudents]);

  useEffect(()=>{
    if (!selectedAssessmentId) { setSelectedAssessment(null); setSelectedSubjectId(""); setStudents([]); setSummativeEntries({}); return; }
    setSelectedAssessment(summativeList.find(a=>a.id===selectedAssessmentId)??null);
    setSelectedSubjectId(""); setStudents([]); setSummativeEntries({});
    setError(null); setSuccess(null);
  },[selectedAssessmentId,summativeList]);

  useEffect(()=>{
    if (!selectedAssessment||!selectedSubjectId) return;
    loadSummativeData(selectedAssessment,selectedSubjectId);
  },[selectedAssessment,selectedSubjectId,loadSummativeData]);

  // Fetch history
  const fetchHistory = useCallback(async ()=>{
    if (!classIds.length) return;
    setLoadingHistory(true);
    try {
      const items:HistoryItem[]=[];
      const validPairs=new Set(teacherClasses.map(tc=>`${tc.class_id}__${tc.subject_id}`));
      const subjectIds=teacherClasses.map(tc=>tc.subject_id);

      // Summative history
      const {data:sResults} = await supabase.from("assessment_results")
        .select("assessment_id,subject_id,assessment_date,status").in("subject_id",subjectIds);
      if (sResults?.length) {
        const asmIds=[...new Set(sResults.map(r=>r.assessment_id))];
        const {data:asms} = await supabase.from("assessments")
          .select("id,title,term,year,class_id,max_marks,assessment_date")
          .in("id",asmIds).in("class_id",classIds).eq("category","summative");
        const asmMap=new Map((asms??[]).map(a=>[a.id,a]));
        const pairs=new Map<string,{count:number;latest:string|null;status:"draft"|"published"}>();
        sResults.forEach(r=>{
          const a=asmMap.get(r.assessment_id);
          if (!a||!validPairs.has(`${a.class_id}__${r.subject_id}`)) return;
          const key=`${r.assessment_id}__${r.subject_id}`;
          if (!pairs.has(key)) pairs.set(key,{count:0,latest:null,status:r.status});
          const p=pairs.get(key)!; p.count++;
          if (r.assessment_date&&(!p.latest||r.assessment_date>p.latest)) p.latest=r.assessment_date;
          if (r.status==="published") p.status="published";
        });
        pairs.forEach((p,key)=>{
          const [asmId,subjectId]=key.split("__");
          const a=asmMap.get(asmId); if (!a) return;
          items.push({ type:"summative", key, title:a.title, term:a.term, year:a.year,
            class_id:a.class_id, subject_id:subjectId, subject_name:subjectNameMap.get(subjectId)??subjectId,
            strand_name:null, sub_strand_name:null,
            result_count:p.count, latest_date:p.latest, status:p.status,
            summativeAssessment:a });
        });
      }

      // Formative history
      const {data:fActivities} = await supabase.from("formative_activities")
        .select("id,title,term,year,class_id,subject_id,strand_id,sub_strand_id,activity_date,teacher_id,description,strands(id,name),sub_strands(id,name)")
        .eq("teacher_id",teacherId).in("class_id",classIds).order("activity_date",{ascending:false});
      if (fActivities?.length) {
        const fIds=fActivities.map(fa=>fa.id);
        const {data:fCounts} = await supabase.from("formative_results")
          .select("formative_activity_id").in("formative_activity_id",fIds);
        const countMap=new Map<string,number>();
        (fCounts??[]).forEach(r=>countMap.set(r.formative_activity_id,(countMap.get(r.formative_activity_id)??0)+1));
        fActivities.forEach(fa=>{
          if (!validPairs.has(`${fa.class_id}__${fa.subject_id}`)) return;
          const strand=firstRel(fa.strands as any); const sub=firstRel(fa.sub_strands as any);
          items.push({ type:"formative", key:fa.id, title:fa.title, term:fa.term, year:fa.year,
            class_id:fa.class_id, subject_id:fa.subject_id, subject_name:subjectNameMap.get(fa.subject_id)??fa.subject_id,
            strand_name:strand?.name??null, sub_strand_name:sub?.name??null,
            result_count:countMap.get(fa.id)??0, latest_date:fa.activity_date, status:"published",
            formativeActivity:fa as unknown as FormativeActivity });
        });
      }

      items.sort((a,b)=>(b.latest_date??"").localeCompare(a.latest_date??""));
      if (isMounted.current) setHistory(items);
    } catch(err) { console.error(err); }
    finally { if (isMounted.current) setLoadingHistory(false); }
  },[classIds,teacherClasses,teacherId,subjectNameMap]);

  useEffect(()=>{ if (mode==="history") fetchHistory(); },[mode,fetchHistory]);

  const resetAll = () => {
    setSelectedAssessmentId(""); setSelectedAssessment(null); setSelectedSubjectId("");
    setFClassId(""); setFSubjectId(""); setFTitle(""); setFDesc("");
    setFStrandId("__none__"); setFStrandName(""); setFSubStrandId("__none__"); setFSubStrandName("");
    setFDate(today()); setFTerm(String(currentTerm??CURRENT_TERM)); setFYear(String(assessmentYear??CURRENT_YEAR));
    setActiveActivity(null); setStudents([]); setSummativeEntries({}); setFormativeEntries({});
    setError(null); setSuccess(null); setCreateErr(null); setEditingItem(null);
  };

  const switchMode = (m:Mode) => { setMode(m); resetAll(); };

  // Create formative activity
  const handleCreateFormative = async () => {
    if (!fClassId||!fSubjectId||!fTitle.trim()||!fDate) { setCreateErr("Class, subject, title and date are required."); return; }
    setCreating(true); setCreateErr(null);
    try {
      const {data,error:err} = await supabase.from("formative_activities").insert({
        teacher_id:teacherId, class_id:fClassId, subject_id:fSubjectId,
        title:fTitle.trim(), description:fDesc.trim()||null,
        strand_id:fStrandId==="__none__"?null:fStrandId,
        sub_strand_id:fSubStrandId==="__none__"?null:fSubStrandId,
        activity_date:fDate, term:parseInt(fTerm), year:parseInt(fYear),
      }).select("id,title,description,term,year,class_id,subject_id,strand_id,sub_strand_id,activity_date,teacher_id").single();
      if (err) throw err;
      const activity:FormativeActivity={...data,
        strands:     fStrandId!=="__none__"    ?{id:fStrandId,    name:fStrandName}    :null,
        sub_strands: fSubStrandId!=="__none__"  ?{id:fSubStrandId, name:fSubStrandName}:null,
      };
      setActiveActivity(activity);
      await loadFormativeData(activity);
      setSuccess(`"${data.title}" created — select performance levels below.`);
    } catch(err:unknown) {
      setCreateErr(err instanceof Error?err.message:"Failed to create activity.");
    } finally { if (isMounted.current) setCreating(false); }
  };

  // Open history item
  const handleEditItem = async (item:HistoryItem) => {
    setEditingItem(item); setError(null); setSuccess(null);
    if (item.type==="summative"&&item.summativeAssessment) {
      setSelectedAssessment(item.summativeAssessment);
      setSelectedSubjectId(item.subject_id);
      await loadSummativeData(item.summativeAssessment,item.subject_id);
    } else if (item.type==="formative"&&item.formativeActivity) {
      setActiveActivity(item.formativeActivity);
      await loadFormativeData(item.formativeActivity);
    }
  };

  const handleBackToHistory = () => {
    setEditingItem(null); setSelectedAssessment(null); setSelectedSubjectId("");
    setActiveActivity(null); setStudents([]); setSummativeEntries({}); setFormativeEntries({});
    setError(null); setSuccess(null); fetchHistory();
  };

  // Entry handlers
  const handleScoreChange = useCallback((id:string,v:string)=>{
    setSummativeEntries(prev=>{ const n=parseFloat(v);
      return {...prev,[id]:{...prev[id],score:v,performance_level:(!isNaN(n)&&selectedAssessment)?perfLevel(n,selectedAssessment.max_marks):null}}; });
  },[selectedAssessment]);

  const handleSRemarksChange   = useCallback((id:string,v:string)=>setSummativeEntries(prev=>({...prev,[id]:{...prev[id],teacher_remarks:v}})),[]);
  const handleSDateChange      = useCallback((id:string,v:string)=>setSummativeEntries(prev=>({...prev,[id]:{...prev[id],date:v}})),[]);
  const handleSAbsentToggle    = useCallback((id:string)=>setSummativeEntries(prev=>({...prev,[id]:{...prev[id],is_absent:!prev[id]?.is_absent,score:"",performance_level:null}})),[]);
  const handleFLevelChange     = useCallback((id:string,l:PerformanceLevel)=>setFormativeEntries(prev=>({...prev,[id]:{...prev[id],performance_level:l}})),[]);
  const handleFCommentChange   = useCallback((id:string,v:string)=>setFormativeEntries(prev=>({...prev,[id]:{...prev[id],teacher_comment:v}})),[]);
  const handleFAbsentToggle    = useCallback((id:string)=>setFormativeEntries(prev=>({...prev,[id]:{...prev[id],is_absent:!prev[id]?.is_absent,performance_level:null}})),[]);

  // Save summative
  const saveSummative = async () => {
    if (!selectedAssessment||!selectedSubjectId) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const records = students.map(s=>{
        const e=summativeEntries[s.id]; if (!e) return null;
        const base={assessment_id:selectedAssessment.id,student_id:s.id,subject_id:selectedSubjectId,
          assessment_date:e.date,teacher_remarks:e.teacher_remarks||null,status:"draft" as const,updated_at:new Date().toISOString()};
        if (e.is_absent) return {...base,score:0,performance_level:null,is_absent:true};
        const score=parseFloat(e.score); if (isNaN(score)||e.score==="") return null;
        return {...base,score,is_absent:false,performance_level:e.performance_level||perfLevel(score,selectedAssessment.max_marks)};
      }).filter(Boolean);
      if (!records.length) { setError("Enter a score for at least one student."); setSaving(false); return; }
      const {error:err} = await supabase.from("assessment_results").upsert(records,{onConflict:"assessment_id,student_id,subject_id",ignoreDuplicates:false});
      if (err) throw err;
      setSuccess(`${records.length} result(s) saved as draft for admin to publish.`);
    } catch(err) { console.error(err); setError("Failed to save. Please try again."); }
    finally { if (isMounted.current) setSaving(false); }
  };

  // Save formative
  const saveFormative = async () => {
    if (!activeActivity) return;
    setSaving(true); setError(null); setSuccess(null);
    try {
      const records = students.map(s=>{
        const e=formativeEntries[s.id]; if (!e) return null;
        if (e.is_absent) return {formative_activity_id:activeActivity.id,student_id:s.id,performance_level:null,is_absent:true,teacher_comment:e.teacher_comment||null,updated_at:new Date().toISOString()};
        if (!e.performance_level) return null;
        return {formative_activity_id:activeActivity.id,student_id:s.id,performance_level:e.performance_level,is_absent:false,teacher_comment:e.teacher_comment||null,updated_at:new Date().toISOString()};
      }).filter(Boolean);
      if (!records.length) { setError("Select EE/ME/AE/BE for at least one student."); setSaving(false); return; }
      const {error:err} = await supabase.from("formative_results").upsert(records,{onConflict:"formative_activity_id,student_id",ignoreDuplicates:false});
      if (err) throw err;
      setActiveActivity(null); setStudents([]); setFormativeEntries({});
      setFTitle(""); setFDesc(""); setFStrandId("__none__"); setFStrandName(""); setFSubStrandId("__none__"); setFSubStrandName(""); setFDate(today());
      setSuccess(`${records.length} result(s) saved and published.`);
    } catch(err) { console.error(err); setError("Failed to save. Please try again."); }
    finally { if (isMounted.current) setSaving(false); }
  };

  // Derived
  const sFilledCount = students.filter(s=>{ const e=summativeEntries[s.id]; return e&&(e.is_absent||e.score!==""); }).length;
  const fFilledCount = students.filter(s=>{ const e=formativeEntries[s.id]; return e&&(e.is_absent||!!e.performance_level); }).length;
  const filteredHistory = history.filter(i=>histFilter==="all"||i.type===histFilter);
  const showSummaryTable  = (mode==="summative"||editingItem?.type==="summative") && !!selectedAssessment && !!selectedSubjectId;
  const showFormativeTable = (mode==="formative"||editingItem?.type==="formative") && !!activeActivity;
  const strandName    = firstRel(activeActivity?.strands as any)?.name;
  const subStrandName = firstRel(activeActivity?.sub_strands as any)?.name;

  const modes: { m: Mode; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { m: "summative", label: "Enter Exam Marks",      Icon: ClipboardList },
    { m: "formative", label: "Record Class Activity", Icon: Plus },
    { m: "history",   label: "View & Edit History",   Icon: History },
  ];

  const currentModeMeta = modes.find(x => x.m === mode)!;
  const ModeIcon = currentModeMeta.Icon;

  return (
    <div className="space-y-4">

      {/* Mode switcher — maroon track pill toggle */}
      <div className="inline-flex items-center rounded-full bg-[#7a1f2b]/8 p-1 border border-[#7a1f2b]/10 w-full sm:w-auto overflow-x-auto">
        {modes.map(({ m, label, Icon }) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
              mode === m
                ? "bg-white text-[#7a1f2b] shadow-[0_2px_8px_-2px_rgba(122,31,43,0.3)]"
                : "text-[#7a1f2b]/70 hover:text-[#7a1f2b]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Card
        className="rounded-2xl border border-[#7a1f2b]/10 bg-white p-0 overflow-hidden"
        style={{ boxShadow: CARD_SHADOW }}
      >
        <SectionHeader
          icon={ModeIcon}
          title={
            mode === "summative" ? "Enter Exam Marks" :
            mode === "formative" ? "Record Class Activity" :
            "View & Edit History"
          }
          subtitle={
            mode === "summative"
              ? `Term ${currentTerm ?? CURRENT_TERM} · ${academicYear ?? assessmentYear ?? CURRENT_YEAR}`
              : mode === "formative"
              ? "Record an activity — publishes immediately"
              : "Edit past records across terms"
          }
        />

        <CardContent className="p-4 sm:p-5 space-y-5">

          {/* ── SUMMATIVE SELECTORS ── */}
          {mode==="summative"&&!editingItem&&(
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">
                  Assessment
                  {currentTerm && <span className="ml-2 text-[10px] normal-case tracking-normal text-muted-foreground font-normal">— Term {currentTerm} only</span>}
                </Label>
                <Select value={selectedAssessmentId} onValueChange={setSelectedAssessmentId}>
                  <SelectTrigger className="rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select an assessment"/></SelectTrigger>
                  <SelectContent>
                    {loadingAssessments
                      ? <div className="flex items-center justify-center p-3"><Loader2 className="h-4 w-4 animate-spin" style={{color: MAROON}}/></div>
                      : summativeList.length===0
                        ? <div className="p-3 text-sm text-muted-foreground">No exams for Term {currentTerm??CURRENT_TERM}. Use History to edit past terms.</div>
                        : summativeList.map(a=>(
                          <SelectItem key={a.id} value={a.id}>
                            {classNameMap.get(a.class_id)||"Unknown"}: {a.title} — Term {a.term}, {a.year}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedAssessment&&(
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Your Subject</Label>
                  <Select value={selectedSubjectId} onValueChange={v=>{setSelectedSubjectId(v);setError(null);setSuccess(null);}}>
                    <SelectTrigger className="rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select your subject"/></SelectTrigger>
                    <SelectContent>
                      {availableSubjects.map(tc=>{ const s=firstRel(tc.subjects); return <SelectItem key={tc.subject_id} value={tc.subject_id}>{s?.name??tc.subject_id}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* ── FORMATIVE CREATION FORM ── */}
          {mode==="formative"&&!activeActivity&&(
            <div className="space-y-4">
              {success&&(
                <div className="bg-green-50 text-green-700 border border-green-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0"/>{success}
                </div>
              )}
              <p className="text-sm text-muted-foreground">Record a new class activity. Results are saved to formative records and publish immediately.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Class *</Label>
                  <Select value={fClassId} onValueChange={v=>{setFClassId(v);setFSubjectId("");}}>
                    <SelectTrigger className="rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select class"/></SelectTrigger>
                    <SelectContent>
                      {uniqueClasses.map(tc=>{ const c=firstRel(tc.classes); return <SelectItem key={tc.class_id} value={tc.class_id}>{c?.name??tc.class_id}{c?.grade_level?` (Grade ${c.grade_level})`:""}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Subject *</Label>
                  <Select value={fSubjectId} onValueChange={setFSubjectId} disabled={!fClassId}>
                    <SelectTrigger className="rounded-xl border-[#7a1f2b]/15"><SelectValue placeholder="Select subject"/></SelectTrigger>
                    <SelectContent>
                      {fSubjects.length===0
                        ? <div className="p-3 text-sm text-muted-foreground">Select a class first</div>
                        : fSubjects.map(tc=>{ const s=firstRel(tc.subjects); return <SelectItem key={tc.subject_id} value={tc.subject_id}>{s?.name??tc.subject_id}</SelectItem>; })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Activity Title *</Label>
                <Input placeholder="e.g. Week 5 Fractions Activity" value={fTitle} onChange={e=>setFTitle(e.target.value)} className="rounded-xl border-[#7a1f2b]/15"/>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">
                  Description / Comment <span className="text-[10px] normal-case tracking-normal text-muted-foreground font-normal ml-1">(optional)</span>
                </Label>
                <Input placeholder="e.g. Group work on place value exercises" value={fDesc} onChange={e=>setFDesc(e.target.value)} className="rounded-xl border-[#7a1f2b]/15"/>
              </div>

              {fSubjectId&&(
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5"/> Strand <span className="text-[10px] normal-case tracking-normal text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <StrandSelect subjectId={fSubjectId} value={fStrandId}
                      onChange={(id,name)=>{setFStrandId(id);setFStrandName(name);setFSubStrandId("__none__");setFSubStrandName("");}}
                      disabled={creating}/>
                  </div>
                  {fStrandId!=="__none__"&&(
                    <div className="space-y-1.5">
                      <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">
                        Sub-strand <span className="text-[10px] normal-case tracking-normal text-muted-foreground font-normal ml-1">(optional)</span>
                      </Label>
                      <SubStrandSelect strandId={fStrandId} value={fSubStrandId}
                        onChange={(id,name)=>{setFSubStrandId(id);setFSubStrandName(name);}}
                        disabled={creating}/>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Term *</Label>
                  <Select value={fTerm} onValueChange={setFTerm}>
                    <SelectTrigger className="rounded-xl border-[#7a1f2b]/15"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Term 1</SelectItem>
                      <SelectItem value="2">Term 2</SelectItem>
                      <SelectItem value="3">Term 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Year *</Label>
                  <Input type="number" value={fYear} onChange={e=>setFYear(e.target.value)} min="2020" max="2100" className="rounded-xl border-[#7a1f2b]/15"/>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Date *</Label>
                  <Input type="date" value={fDate} onChange={e=>setFDate(e.target.value)} className="rounded-xl border-[#7a1f2b]/15"/>
                </div>
              </div>

              {createErr&&(
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0"/>{createErr}
                </div>
              )}

              <Button
                onClick={handleCreateFormative}
                disabled={creating||!fClassId||!fSubjectId||!fTitle.trim()||!fDate}
                className="w-full sm:w-auto text-white hover:opacity-90 rounded-xl font-semibold"
                style={{background: MAROON_GRADIENT}}
              >
                {creating?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating…</>:<><Plus className="mr-2 h-4 w-4"/>Create & Enter Marks</>}
              </Button>
            </div>
          )}

          {/* ── HISTORY LIST ── */}
          {mode==="history"&&!editingItem&&(
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap items-center">
                <div className="inline-flex items-center rounded-full bg-[#7a1f2b]/8 p-1 border border-[#7a1f2b]/10">
                  {(["all","summative","formative"] as const).map(f=>(
                    <button key={f} onClick={()=>setHistFilter(f)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                        histFilter===f
                          ? "bg-white text-[#7a1f2b] shadow-[0_2px_8px_-2px_rgba(122,31,43,0.3)]"
                          : "text-[#7a1f2b]/70 hover:text-[#7a1f2b]"
                      }`}>
                      {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-1">{filteredHistory.length} record{filteredHistory.length!==1?"s":""}</span>
              </div>
              {loadingHistory
                ? <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" style={{color: MAROON}}/></div>
                : filteredHistory.length===0
                  ? <div className="text-center py-10 text-muted-foreground text-sm">
                      <History className="h-10 w-10 mx-auto mb-2" style={{color: "rgba(122,31,43,0.2)"}}/>No records found yet.
                    </div>
                  : <div className="space-y-2">
                    {filteredHistory.map((item,idx)=>(
                      <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-[#7a1f2b]/10 hover:border-[#7a1f2b]/25 bg-white gap-3 transition-colors">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm text-[#3a1b1f]">{item.title}</span>
                            <Badge variant="outline" className="text-[10px] font-semibold bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/15 rounded-full uppercase tracking-wider">
                              {item.type}
                            </Badge>
                            <Badge variant="outline" className={
                              item.status==="published"
                                ? "bg-green-50 text-green-700 border-green-200 text-[10px] font-semibold rounded-full uppercase tracking-wider"
                                : "bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-semibold rounded-full uppercase tracking-wider"
                            }>
                              {item.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{classNameMap.get(item.class_id)??item.class_id}</span><span>•</span>
                            <span>{item.subject_name}</span><span>•</span>
                            <span>Term {item.term}, {item.year}</span><span>•</span>
                            <span>{item.result_count} student{item.result_count!==1?"s":""}</span>
                            {item.latest_date&&<><span>•</span><span>{new Date(item.latest_date).toLocaleDateString()}</span></>}
                          </div>
                          {item.strand_name&&(
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <BookOpen className="h-3 w-3"/>{item.strand_name}{item.sub_strand_name&&` › ${item.sub_strand_name}`}
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={()=>handleEditItem(item)}
                          className="h-8 shrink-0 gap-1 rounded-xl border-[#7a1f2b]/20 text-[#7a1f2b] hover:bg-[#7a1f2b]/5 hover:text-[#7a1f2b]"
                        >
                          <Pencil className="h-3 w-3"/>Edit
                        </Button>
                      </div>
                    ))}
                  </div>}
            </div>
          )}

          {/* ── SUMMATIVE TABLE ── */}
          {showSummaryTable&&selectedAssessment&&(
            <>
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#7a1f2b]/5 border border-[#7a1f2b]/10 text-sm">
                {editingItem&&(
                  <button onClick={handleBackToHistory} className="flex items-center gap-1 text-xs text-[#7a1f2b] font-medium hover:underline">
                    <ArrowLeft className="h-3 w-3"/>Back to history
                  </button>
                )}
                <Badge variant="outline" className="text-[10px] font-semibold bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/15 rounded-full uppercase tracking-wider">summative</Badge>
                <span className="text-muted-foreground">Max: <strong className="text-[#3a1b1f]">{selectedAssessment.max_marks}</strong></span>
                <span className="font-semibold text-[#3a1b1f]">{selectedAssessment.title}</span>
                <span className="text-xs text-muted-foreground">Subject: <strong className="text-[#3a1b1f]">{subjectNameMap.get(selectedSubjectId)}</strong></span>
              </div>
              {error&&(
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0"/>{error}
                </div>
              )}
              {success&&(
                <div className="bg-green-50 text-green-700 border border-green-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0"/>{success}
                </div>
              )}
              {loadingData
                ? <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" style={{color: MAROON}}/></div>
                : students.length===0
                  ? <div className="text-center py-10 text-muted-foreground text-sm">No students enrolled.</div>
                  : <>
                    <div className="overflow-x-auto rounded-xl border border-[#7a1f2b]/10">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#7a1f2b]/10 bg-[#7a1f2b]/[0.03]">
                            <TableHead className="w-[90px] text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Reg No</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Name</TableHead>
                            <TableHead className="w-[70px] text-center text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Absent</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Score (/ {selectedAssessment.max_marks})</TableHead>
                            <TableHead className="w-[180px] text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Remarks</TableHead>
                            <TableHead className="w-[140px] text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(s=>{
                            const e=summativeEntries[s.id]??{score:"",performance_level:null,teacher_remarks:"",is_absent:false,date:selectedAssessment.assessment_date||today()};
                            return (
                              <TableRow key={s.id} className={`border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.02] ${e.is_absent?"opacity-50":""}`}>
                                <TableCell className="font-mono text-xs">{s.Reg_no}</TableCell>
                                <TableCell className="font-medium text-[#3a1b1f]">{s.first_name} {s.last_name}</TableCell>
                                <TableCell className="text-center">
                                  <input type="checkbox" checked={e.is_absent} onChange={()=>handleSAbsentToggle(s.id)} className="h-4 w-4 rounded accent-[#7a1f2b]"/>
                                </TableCell>
                                <TableCell>
                                  {e.is_absent
                                    ? <span className="text-xs italic text-muted-foreground">Absent</span>
                                    : <div className="flex items-center gap-2">
                                        <ScoreInput value={e.score} studentId={s.id} maxMarks={selectedAssessment.max_marks} disabled={false} onChange={handleScoreChange}/>
                                        {e.performance_level&&<PerfBadge level={e.performance_level}/>}
                                      </div>}
                                </TableCell>
                                <TableCell><TextInput value={e.teacher_remarks} studentId={s.id} placeholder="Optional remark" disabled={false} onChange={handleSRemarksChange}/></TableCell>
                                <TableCell><Input type="date" value={e.date} onChange={ev=>handleSDateChange(s.id,ev.target.value)} className="w-36 rounded-lg border-[#7a1f2b]/15"/></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-muted-foreground">{sFilledCount} / {students.length} entries ready</span>
                      <Button
                        onClick={saveSummative}
                        disabled={saving||sFilledCount===0}
                        className="text-white hover:opacity-90 rounded-xl font-semibold"
                        style={{background: MAROON_GRADIENT}}
                      >
                        {saving?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</>:<><Save className="mr-2 h-4 w-4"/>Save Draft</>}
                      </Button>
                    </div>
                  </>}
            </>
          )}

          {/* ── FORMATIVE TABLE ── */}
          {showFormativeTable&&activeActivity&&(
            <>
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-[#7a1f2b]/5 border border-[#7a1f2b]/10 text-sm">
                <button
                  onClick={editingItem?handleBackToHistory:()=>{setActiveActivity(null);setStudents([]);setFormativeEntries({});setSuccess(null);}}
                  className="flex items-center gap-1 text-xs text-[#7a1f2b] font-medium hover:underline"
                >
                  <ArrowLeft className="h-3 w-3"/>{editingItem?"Back to history":"New activity"}
                </button>
                <Badge variant="outline" className="text-[10px] font-semibold bg-[#7a1f2b]/8 text-[#7a1f2b] border-[#7a1f2b]/15 rounded-full uppercase tracking-wider">formative</Badge>
                <span className="font-semibold text-[#3a1b1f]">{activeActivity.title}</span>
                <span className="text-xs text-muted-foreground">Subject: <strong className="text-[#3a1b1f]">{subjectNameMap.get(activeActivity.subject_id)}</strong></span>
                {strandName&&(
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <BookOpen className="h-3.5 w-3.5"/><strong className="text-[#3a1b1f]">{strandName}</strong>{subStrandName&&<> › <strong className="text-[#3a1b1f]">{subStrandName}</strong></>}
                  </span>
                )}
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#7a1f2b]/8 border border-[#7a1f2b]/15" style={{color: MAROON}}>
                  Publishes immediately
                </span>
              </div>
              {error&&(
                <div className="bg-red-50 text-red-700 border border-red-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0"/>{error}
                </div>
              )}
              {success&&(
                <div className="bg-green-50 text-green-700 border border-green-200 p-3 rounded-xl flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 shrink-0"/>{success}
                </div>
              )}
              {loadingData
                ? <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" style={{color: MAROON}}/></div>
                : students.length===0
                  ? <div className="text-center py-10 text-muted-foreground text-sm">No students enrolled.</div>
                  : <>
                    <div className="overflow-x-auto rounded-xl border border-[#7a1f2b]/10">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#7a1f2b]/10 bg-[#7a1f2b]/[0.03]">
                            <TableHead className="w-[90px] text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Reg No</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Name</TableHead>
                            <TableHead className="w-[70px] text-center text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Absent</TableHead>
                            <TableHead className="text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Performance Level</TableHead>
                            <TableHead className="w-[220px] text-[10px] uppercase tracking-wider text-[#7a1f2b]/70 font-semibold">Comment</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map(s=>{
                            const e=formativeEntries[s.id]??{performance_level:null,teacher_comment:"",is_absent:false};
                            return (
                              <TableRow key={s.id} className={`border-[#7a1f2b]/5 hover:bg-[#7a1f2b]/[0.02] ${e.is_absent?"opacity-50":""}`}>
                                <TableCell className="font-mono text-xs">{s.Reg_no}</TableCell>
                                <TableCell className="font-medium text-[#3a1b1f]">{s.first_name} {s.last_name}</TableCell>
                                <TableCell className="text-center">
                                  <input type="checkbox" checked={e.is_absent} onChange={()=>handleFAbsentToggle(s.id)} className="h-4 w-4 rounded accent-[#7a1f2b]"/>
                                </TableCell>
                                <TableCell>
                                  {e.is_absent
                                    ? <span className="text-xs italic text-muted-foreground">Absent</span>
                                    : <LevelToggle value={e.performance_level} onChange={l=>handleFLevelChange(s.id,l)} disabled={false}/>}
                                </TableCell>
                                <TableCell><TextInput value={e.teacher_comment} studentId={s.id} placeholder="Comment on this student" disabled={false} onChange={handleFCommentChange}/></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="flex items-center justify-between pt-2 gap-3 flex-wrap">
                      <span className="text-sm text-muted-foreground">
                        {fFilledCount} / {students.length} entries ready
                        <span className="text-xs text-[#7a1f2b] ml-1 font-medium">• publishes immediately</span>
                      </span>
                      <Button
                        onClick={saveFormative}
                        disabled={saving||fFilledCount===0}
                        className="text-white hover:opacity-90 rounded-xl font-semibold"
                        style={{background: MAROON_GRADIENT}}
                      >
                        {saving?<><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Saving…</>:<><CheckCircle className="mr-2 h-4 w-4"/>Save & Publish</>}
                      </Button>
                    </div>
                  </>}
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}