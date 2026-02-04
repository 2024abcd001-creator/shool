
import React, { useState, useEffect, useRef } from 'react';
import { Student, StudentInput, ClassGroup } from './types';
import StudentTable from './components/StudentTable';
import StudentForm from './components/StudentForm';
import { getStudentAnalysis } from './services/gemini';

type ViewMode = ClassGroup | 'ALL';

const App: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [activeTab, setActiveTab] = useState<ViewMode>('ALL');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load students from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('edu_track_students');
    if (saved) {
      try {
        setStudents(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load students", e);
      }
    }
  }, []);

  // Save students to localStorage
  useEffect(() => {
    localStorage.setItem('edu_track_students', JSON.stringify(students));
  }, [students]);

  const addStudent = (input: StudentInput) => {
    const newStudent: Student = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
    };
    setStudents(prev => [...prev, newStudent]);
  };

  const updateStudent = (id: string, input: StudentInput) => {
    setStudents(prev => prev.map(s => s.id === id ? { ...s, ...input } : s));
  };

  const deleteStudent = (id: string) => {
    if (window.confirm('정말 이 학생의 정보를 삭제하시겠습니까?')) {
      setStudents(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingStudent(null);
  };

  const filteredStudents = activeTab === 'ALL' 
    ? students 
    : students.filter(s => s.group === activeTab);

  const handleAiAnalysis = async () => {
    setIsAnalyzing(true);
    const result = await getStudentAnalysis(filteredStudents, activeTab === 'ALL' ? '전체' : `${activeTab}반`);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const exportToCsv = () => {
    if (filteredStudents.length === 0) {
      alert('내보낼 학생 데이터가 없습니다.');
      return;
    }

    const headers = ['학년', '반', '번호', '방과후그룹', '이름', '전화번호', '비고'];
    const rows = filteredStudents.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      if (a.grade !== b.grade) return a.grade - b.grade;
      if (a.schoolClass !== b.schoolClass) return a.schoolClass - b.schoolClass;
      return a.number - b.number;
    }).map(s => [
      s.grade,
      s.schoolClass,
      s.number,
      s.group,
      s.name,
      s.phone,
      `"${(s.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filename = activeTab === 'ALL' ? '전체_학생_명단' : `방과후컴퓨터_${activeTab}반_명단`;
    link.setAttribute('download', `${filename}_${new Date().toLocaleDateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCsvImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/);
      
      const dataLines = lines.slice(1).filter(line => line.trim() !== "");
      
      const importedStudents: Student[] = [];
      
      for (const line of dataLines) {
        // Simple but effective CSV split logic
        const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        const clean = (val: string) => (val || "").replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        
        if (!clean(parts[4])) continue; // 이름 없으면 스킵

        const grade = parseInt(clean(parts[0])) || 1;
        const schoolClass = parseInt(clean(parts[1])) || 1;
        const number = parseInt(clean(parts[2])) || 1;
        const groupRaw = clean(parts[3]).toUpperCase();
        const group: ClassGroup = (['A', 'B', 'C'].includes(groupRaw) ? groupRaw : 'A') as ClassGroup;
        const name = clean(parts[4]) || "이름없음";
        const phone = clean(parts[5]) || "";
        const remarks = clean(parts[6]) || "";

        importedStudents.push({
          id: crypto.randomUUID(),
          grade,
          schoolClass,
          number,
          group,
          name,
          phone,
          remarks,
          createdAt: Date.now(),
        });
      }

      if (importedStudents.length > 0) {
        setStudents(prev => [...prev, ...importedStudents]);
        alert(`${importedStudents.length}명의 학생이 성공적으로 등록되었습니다.`);
      } else {
        alert('데이터를 읽어오지 못했습니다. CSV 형식을 확인해주세요.');
      }
      
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file, "UTF-8");
  };

  return (
    <div className="min-h-screen pb-12">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleCsvImport} 
        accept=".csv" 
        className="hidden" 
      />

      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">방과후 컴퓨터 <span className="text-indigo-600">학생관리</span></h1>
          </div>
          <button
            onClick={() => {
              setEditingStudent(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">학생 추가</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 mt-8">
        {/* Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm border-l-4 border-l-indigo-600">
            <p className="text-gray-400 text-xs font-bold uppercase mb-1">전체 학생</p>
            <p className="text-2xl font-black text-gray-900">{students.length}명</p>
          </div>
          {(['A', 'B', 'C'] as ClassGroup[]).map(group => (
            <div key={group} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
              <p className="text-gray-400 text-xs font-bold uppercase mb-1">{group}반 수업</p>
              <p className="text-2xl font-black text-indigo-600">
                {students.filter(s => s.group === group).length}명
              </p>
            </div>
          ))}
        </div>

        {/* Tab Controls */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-center mb-6">
          <div className="bg-gray-100 p-1.5 rounded-2xl inline-flex w-full lg:w-auto shadow-inner overflow-x-auto no-scrollbar">
            {(['ALL', 'A', 'B', 'C'] as ViewMode[]).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setAiAnalysis('');
                }}
                className={`flex-1 sm:flex-none whitespace-nowrap px-8 py-3 rounded-xl font-black transition-all ${
                  activeTab === tab
                    ? 'bg-white text-indigo-600 shadow-md transform scale-105'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {tab === 'ALL' ? '전체 보기' : `${tab}반`}
              </button>
            ))}
          </div>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:border-green-500 hover:text-green-600 transition-all shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              명단 업로드
            </button>

            <button
              onClick={exportToCsv}
              disabled={filteredStudents.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:border-gray-400 transition-all shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              명단 내보내기
            </button>

            <button
              onClick={handleAiAnalysis}
              disabled={isAnalyzing || filteredStudents.length === 0}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.989-2.386l-.548-.547z" />
                </svg>
              )}
              AI 학급 분석
            </button>
          </div>
        </div>

        {/* AI Insight Box */}
        {aiAnalysis && (
          <div className="mb-8 p-8 bg-gradient-to-br from-indigo-50 to-white rounded-3xl border border-indigo-100 relative overflow-hidden shadow-xl shadow-indigo-100/50 animate-in slide-in-from-top duration-500">
            <div className="absolute top-0 right-0 p-6 opacity-5">
              <svg className="w-32 h-32 text-indigo-900" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1a1 1 0 112 0v1a1 1 0 11-2 0zM13.536 14.95a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM15 10a5 5 0 11-10 0 5 5 0 0110 0z" />
              </svg>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center animate-bounce">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.047a1 1 0 01.897.95V4.69a2 2 0 11-2.4 0V1.997a1 1 0 01.897-.95zm-2.736 5.73a2 2 0 111.418 3.165 2 2 0 11-1.418-3.165z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-indigo-900 font-black text-xl">AI 분석 리포트 <span className="text-indigo-400 ml-1"># {activeTab === 'ALL' ? '전체' : activeTab + '반'}</span></h3>
              </div>
              <p className="text-indigo-800 leading-relaxed font-medium text-lg whitespace-pre-wrap">{aiAnalysis}</p>
            </div>
          </div>
        )}

        {/* Student Table */}
        <StudentTable 
          students={filteredStudents} 
          onDelete={deleteStudent} 
          onEdit={handleEditClick}
          showGroupColumn={activeTab === 'ALL'}
        />
      </main>

      {/* Add/Edit Form Modal */}
      {isFormOpen && (
        <StudentForm
          defaultClass={activeTab === 'ALL' ? 'A' : activeTab}
          initialData={editingStudent}
          onAdd={addStudent}
          onUpdate={updateStudent}
          onClose={closeForm}
        />
      )}

      <footer className="mt-20 text-center text-gray-400 text-sm border-t border-gray-100 pt-8 pb-12">
        <p className="font-bold text-gray-500">방과후 컴퓨터 교실 선생님을 위한 스마트 도우미</p>
        <p className="mt-1">© 2024 EDU-TRACK. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;
