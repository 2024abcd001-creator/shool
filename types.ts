
export type ClassGroup = 'A' | 'B' | 'C';

export interface Student {
  id: string;
  grade: number;       // 학교 학년 (숫자)
  schoolClass: number; // 학교 반 (숫자)
  number: number;      // 학교 번호 (숫자)
  group: ClassGroup;   // 방과후 수업 그룹 (A, B, C)
  name: string;
  phone: string;
  remarks: string;
  createdAt: number;
}

export interface StudentInput {
  grade: number;
  schoolClass: number;
  number: number;
  group: ClassGroup;
  name: string;
  phone: string;
  remarks: string;
}
