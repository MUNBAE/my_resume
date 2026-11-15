// 수동 연계용 프롬프트 생성 (서버·클라이언트 공용 순수 함수 모음, 외부 호출 없음)

// 프롬프트에 넣을 문서 (출처로 쓸 Notion 페이지 ID 포함)
export interface PromptDocument {
  id: string
  title: string
  text: string
}

// AI가 따를 출력 JSON 예시 — resumeSchema를 통과하는 값이어야 한다 (테스트로 보장)
export const OUTPUT_EXAMPLE = {
  experiences: [
    {
      id: 'exp-1',
      company: '예시회사',
      position: '선임 연구원',
      startDate: '2021-03',
      endDate: null,
      summary: '한 줄 요약',
      achievements: [
        {
          text: '원문에 있던 성과 문장',
          origin: 'original',
          sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
        },
        {
          text: '다른 문서 본문에서 찾아 보강한 성과 문장',
          origin: 'enriched',
          sources: [{ documentId: '문서ID-2', title: '문서 제목' }],
        },
      ],
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [
        {
          field: 'position',
          candidates: [
            {
              value: '선임 연구원',
              sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
            },
            {
              value: '책임 연구원',
              sources: [{ documentId: '문서ID-2', title: '문서 제목' }],
            },
          ],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'prj-1',
      name: '예시 프로젝트',
      startDate: '2022-01',
      endDate: '2022-06',
      role: '백엔드 개발',
      summary: '한 줄 요약',
      technologies: ['TypeScript', 'PostgreSQL'],
      achievements: [],
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  skills: [
    {
      id: 'skl-1',
      category: '언어',
      name: 'TypeScript',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  educations: [
    {
      id: 'edu-1',
      school: '예시대학교',
      major: '컴퓨터공학',
      degree: '학사',
      status: '졸업',
      gpa: '3.8 / 4.5',
      startDate: '2014-03',
      endDate: '2020-02',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
  certifications: [
    {
      id: 'crt-1',
      name: '정보처리기사',
      issuer: '한국산업인력공단',
      grade: '합격',
      date: '2019-05',
      sources: [{ documentId: '문서ID-1', title: '문서 제목' }],
      conflicts: [],
    },
  ],
}

// 출력 형식 지시문: 필드 규칙 + 예시 JSON
export function buildSchemaInstruction(): string {
  return [
    '## 출력 형식',
    '반드시 아래 구조의 JSON 하나만 출력하세요. JSON 앞뒤에 설명 문장을 붙이지 마세요. (```json 코드 블록으로 감싸는 것은 허용)',
    '',
    '필드 규칙:',
    '- 최상위 키: experiences(경력), projects(프로젝트), skills(기술), educations(학력), certifications(자격). 해당 항목이 없으면 빈 배열 []',
    '- 모든 항목에는 id(문자열, 항목마다 고유: exp-1, prj-1, skl-1, edu-1, crt-1 …)와 sources(출처 배열, 최소 1개)가 필수입니다.',
    '- sources의 documentId에는 입력 문서 구분선에 적힌 "문서 ID"를 그대로 적고, title에는 그 문서 제목을 적으세요. 입력에 없는 ID를 만들지 마세요.',
    '- 날짜는 "YYYY-MM" 또는 "YYYY" 형식입니다. 현재 재직·진행 중이면 endDate는 null 입니다. 날짜를 알 수 없으면 경력은 가장 가까운 근거로 적되 추측하지 말고, 선택 필드(프로젝트·학력·자격)는 생략하세요.',
    '- experiences: company, startDate, endDate는 필수이고 position, summary는 선택입니다. achievements는 성과 배열입니다.',
    '- achievements의 각 항목: text(성과 문장), origin("original" 또는 "enriched"), sources(최소 1개)',
    '- educations: school은 필수이고 major(전공), degree(학사·석사 등), status(졸업·재학·교육이수 등), gpa(학점 문자열), program(대학 외 교육과정명), startDate, endDate는 선택입니다.',
    '- certifications: name은 필수이고 issuer(발급처), grade(등급·점수), date는 선택입니다.',
    '- 위에 적지 않은 필드명은 사용하지 마세요. 해당 내용은 가장 가까운 필드(summary 등)에 문장으로 넣으세요.',
    '- conflicts: 항목 하나의 같은 필드 값이 문서마다 다를 때만 채웁니다. 충돌이 없으면 빈 배열 [] 입니다. candidates의 value는 항상 문자열이며, "현재 재직·진행 중"은 null이 아니라 "현재"라고 적으세요. candidates는 서로 다른 값 2개 이상입니다.',
    '',
    '예시:',
    '```json',
    JSON.stringify(OUTPUT_EXAMPLE, null, 2),
    '```',
  ].join('\n')
}

// 병합·보강 규칙 지시문
const MERGE_RULES = `## 역할
당신은 이력서 편집자입니다. 아래 "입력 문서"들은 한 사람의 이력서·지원서·포트폴리오입니다. 이 문서들만 근거로 하나의 최신 통합 이력서 데이터를 만드세요.

## 핵심 규칙
1. 근거 없는 내용 금지: 입력 문서에 없는 회사·직함·기간·수치·기술·성과를 만들거나 추측하지 마세요. 확실하지 않으면 해당 필드를 생략하세요.
2. 출처 필수: 모든 항목과 모든 성과 문장에 그 내용이 나온 문서의 "문서 ID"를 sources로 적으세요. 여러 문서에 나오면 모두 적으세요.
3. 중복 제거: 같은 회사(또는 같은 프로젝트)는 회사·프로젝트 이름과 기간이 겹치는지로 식별해 하나의 항목으로 합치세요. 표기만 다른 경우(예: (주)A, A㈜)도 같은 곳으로 봅니다.
4. 충돌 처리: 같은 항목의 기간·직함 등이 문서마다 다르면 임의로 하나를 고르지 마세요. 가장 최근에 작성된 것으로 보이는 문서의 값을 임시로 필드에 넣고, 모든 후보 값과 각각의 출처를 conflicts에 기록하세요. 최종 선택은 사용자가 합니다.
5. 정렬: experiences는 최신순(시작일이 늦은 순)으로 정렬하세요.

## 문서 기반 보강 규칙
- 지원서·포트폴리오·자기소개서 본문에서 정량 성과, 맡은 역할, 사용 기술, 문제 해결 사례를 찾아 관련된 경력·프로젝트의 achievements에 연결하세요.
- 이력서에 이미 있던 성과는 origin을 "original", 다른 문서 본문에서 찾아 새로 추가한 성과는 "enriched"로 표시하세요.
- enriched 성과도 반드시 입력 문서에 실제로 있는 내용이어야 하며, 근거가 된 문서 ID를 sources에 적으세요. 수치는 원문 그대로 옮기고 바꾸거나 새로 만들지 마세요.
- 어느 경력·프로젝트에 속하는지 불분명한 내용은 억지로 연결하지 말고 넣지 마세요.`

// 입력 문서 블록: 문서마다 구분선 + ID + 제목을 붙인다
export function formatDocuments(documents: PromptDocument[]): string {
  return documents
    .map(
      doc =>
        `=== 문서 시작 | 문서 ID: ${doc.id} | 제목: ${doc.title} ===\n${doc.text}\n=== 문서 끝 | 문서 ID: ${doc.id} ===`
    )
    .join('\n\n')
}

// 병합·보강 프롬프트 전체를 만든다
export function buildMergePrompt(documents: PromptDocument[]): string {
  return [
    MERGE_RULES,
    buildSchemaInstruction(),
    '## 입력 문서',
    formatDocuments(documents),
  ].join('\n\n')
}
