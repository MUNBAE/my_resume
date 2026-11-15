import { z } from 'zod'

// 출처: Notion 문서 페이지 ID (PRD §3.3 — 모든 항목에 출처 필수)
export const sourceRefSchema = z.object({
  documentId: z.string().min(1),
  title: z.string().optional(),
})

// 항목 단위 출처 목록 (최소 1개)
const sourcesSchema = z.array(sourceRefSchema).min(1, '출처가 필요합니다')

// 기간 표기: YYYY 또는 YYYY-MM
const periodSchema = z.string().regex(/^\d{4}(-\d{2})?$/, 'YYYY 또는 YYYY-MM')

// 충돌 후보: 같은 항목의 필드값이 문서마다 다를 때 사용자가 고른다 (PRD §3.2)
export const conflictSchema = z.object({
  field: z.string().min(1),
  candidates: z
    .array(
      z.object({
        value: z.string(),
        sources: sourcesSchema,
      })
    )
    .min(2, '충돌 후보는 2개 이상이어야 합니다'),
})

// 성과 문장: 원문 그대로인지 보강된 것인지 구분한다 (PRD §3.3)
export const achievementSchema = z.object({
  text: z.string().min(1),
  origin: z.enum(['original', 'enriched']),
  sources: sourcesSchema,
})

const itemBase = {
  id: z.string().min(1),
  sources: sourcesSchema,
  conflicts: z.array(conflictSchema).default([]),
}

// 경력
export const experienceSchema = z.object({
  ...itemBase,
  company: z.string().min(1),
  position: z.string().optional(),
  startDate: periodSchema,
  endDate: periodSchema.nullable(), // null = 재직 중
  summary: z.string().optional(),
  achievements: z.array(achievementSchema).default([]),
})

// 프로젝트
export const projectSchema = z.object({
  ...itemBase,
  name: z.string().min(1),
  startDate: periodSchema.optional(),
  endDate: periodSchema.nullable().optional(),
  role: z.string().optional(),
  summary: z.string().optional(),
  technologies: z.array(z.string()).default([]),
  achievements: z.array(achievementSchema).default([]),
})

// 기술 스택
export const skillSchema = z.object({
  ...itemBase,
  category: z.string().optional(),
  name: z.string().min(1),
})

// 학력
export const educationSchema = z.object({
  ...itemBase,
  school: z.string().min(1),
  major: z.string().optional(),
  startDate: periodSchema.optional(),
  endDate: periodSchema.nullable().optional(),
})

// 자격·수상
export const certificationSchema = z.object({
  ...itemBase,
  name: z.string().min(1),
  issuer: z.string().optional(),
  date: periodSchema.optional(),
})

// 병합 결과 전체
export const resumeSchema = z.object({
  experiences: z.array(experienceSchema).default([]),
  projects: z.array(projectSchema).default([]),
  skills: z.array(skillSchema).default([]),
  educations: z.array(educationSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
})

export type SourceRef = z.infer<typeof sourceRefSchema>
export type Conflict = z.infer<typeof conflictSchema>
export type Achievement = z.infer<typeof achievementSchema>
export type Experience = z.infer<typeof experienceSchema>
export type Project = z.infer<typeof projectSchema>
export type Skill = z.infer<typeof skillSchema>
export type Education = z.infer<typeof educationSchema>
export type Certification = z.infer<typeof certificationSchema>
export type Resume = z.infer<typeof resumeSchema>
