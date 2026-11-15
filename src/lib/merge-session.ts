// /resume → /resume/merge 로 병합 초안을 넘기는 sessionStorage 보관소 (클라이언트 전용).
// 탭을 닫으면 사라지고 서버에는 저장하지 않는다. 저장소 값은 신뢰하지 않고 다시 검증한다.
import { resumeSchema, type Resume } from '@/types/resume'

const KEY = 'resume-merge-draft'

export interface DraftDocument {
  id: string
  title: string
  lastEditedTime: string
}

export interface MergeDraft {
  resume: Resume
  /** 출처 검증 등에서 걸러낸 내용 */
  warnings: string[]
  /** 병합에 사용한 문서 (기준본 선택·제목 표시용) */
  documents: DraftDocument[]
}

// 사생활 모드·저장 공간 차단 등으로 접근이 실패해도 앱이 죽지 않게 한다
export function saveMergeDraft(draft: MergeDraft): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function loadMergeDraft(): MergeDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<MergeDraft>
    const resume = resumeSchema.safeParse(data.resume)
    if (!resume.success || !Array.isArray(data.documents)) return null
    return {
      resume: resume.data,
      warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
      documents: data.documents as DraftDocument[],
    }
  } catch {
    return null
  }
}

export function clearMergeDraft(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // 무시
  }
}
