import { Badge } from '@/components/ui/badge'
import { SourceBadges, sourceTitles } from '@/components/resume/source-badge'
import { cn } from '@/lib/utils'
import type {
  Achievement,
  Certification,
  Education,
  Experience,
  Project,
  Resume,
  SourceRef,
  Skill,
} from '@/types/resume'

// "2021-03" → "2021.03", null → "현재"
const formatPeriodPart = (value: string | null | undefined) =>
  value === null ? '현재' : value?.replace('-', '.')

function formatPeriod(start?: string, end?: string | null): string | undefined {
  if (!start && end === undefined) return undefined
  return `${formatPeriodPart(start) ?? ''} – ${end === undefined ? '' : formatPeriodPart(end)}`.trim()
}

function Section({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-4">
      <h2 className="border-b pb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function ItemHeader({
  title,
  subtitle,
  period,
  sources,
}: {
  title: string
  subtitle?: string
  period?: string
  sources: SourceRef[]
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="min-w-0">
        <h3 className="font-medium break-words">{title}</h3>
        {subtitle && (
          <p className="text-muted-foreground text-sm break-words">
            {subtitle}
          </p>
        )}
        <SourceBadges sources={sources} className="mt-1.5" />
      </div>
      {period && (
        <p className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {period}
        </p>
      )}
    </div>
  )
}

function Achievements({ items }: { items: Achievement[] }) {
  if (items.length === 0) return null
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
      {items.map((item, index) => (
        <li key={index} className="break-words">
          {item.text}
          {item.origin === 'enriched' && (
            <Badge variant="secondary" className="ml-2 align-middle">
              보강
            </Badge>
          )}
          <SourceBadges sources={item.sources} className="mt-1 flex" />
        </li>
      ))}
    </ul>
  )
}

function ExperienceItem({ item }: { item: Experience }) {
  return (
    <article>
      <ItemHeader
        title={item.company}
        subtitle={item.position}
        period={formatPeriod(item.startDate, item.endDate)}
        sources={item.sources}
      />
      {item.summary && <p className="mt-1 text-sm">{item.summary}</p>}
      <Achievements items={item.achievements} />
    </article>
  )
}

function ProjectItem({ item }: { item: Project }) {
  return (
    <article>
      <ItemHeader
        title={item.name}
        subtitle={item.role}
        period={formatPeriod(item.startDate, item.endDate)}
        sources={item.sources}
      />
      {item.summary && <p className="mt-1 text-sm">{item.summary}</p>}
      {item.technologies.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.technologies.map(tech => (
            <Badge key={tech} variant="outline">
              {tech}
            </Badge>
          ))}
        </div>
      )}
      <Achievements items={item.achievements} />
    </article>
  )
}

function SkillGroups({ skills }: { skills: Skill[] }) {
  // 카테고리별로 묶는다 (없으면 '기타')
  const groups = new Map<string, Skill[]>()
  for (const skill of skills) {
    const key = skill.category?.trim() || '기타'
    groups.set(key, [...(groups.get(key) ?? []), skill])
  }
  return (
    <dl className="space-y-2">
      {[...groups.entries()].map(([category, items]) => (
        <div
          key={category}
          className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-4"
        >
          <dt className="text-muted-foreground w-24 shrink-0 text-sm">
            {category}
          </dt>
          <dd className="flex flex-wrap gap-1.5">
            {items.map(skill => (
              <Badge
                key={skill.id}
                variant="secondary"
                title={sourceTitles(skill.sources)}
              >
                {skill.name}
              </Badge>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EducationItem({ item }: { item: Education }) {
  return (
    <article>
      <ItemHeader
        title={item.school}
        subtitle={
          [
            item.major,
            item.degree,
            item.status,
            item.gpa ? `학점 ${item.gpa}` : item.program,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        period={formatPeriod(item.startDate, item.endDate)}
        sources={item.sources}
      />
    </article>
  )
}

function CertificationItem({ item }: { item: Certification }) {
  return (
    <article>
      <ItemHeader
        title={item.name}
        subtitle={
          [item.issuer, item.grade].filter(Boolean).join(' · ') || undefined
        }
        period={item.date?.replace('-', '.')}
        sources={item.sources}
      />
    </article>
  )
}

interface ResumePreviewProps {
  resume: Resume
  className?: string
}

// 병합 결과를 이력서 형태로 렌더링한다 (PRD §3.4). 경력은 입력 순서를 그대로 쓴다
// (정렬은 resume-normalize에서 끝난 상태).
export function ResumePreview({ resume, className }: ResumePreviewProps) {
  return (
    <div className={cn('space-y-8', className)}>
      <Section title="경력" count={resume.experiences.length}>
        <div className="space-y-6">
          {resume.experiences.map(item => (
            <ExperienceItem key={item.id} item={item} />
          ))}
        </div>
      </Section>
      <Section title="프로젝트" count={resume.projects.length}>
        <div className="space-y-6">
          {resume.projects.map(item => (
            <ProjectItem key={item.id} item={item} />
          ))}
        </div>
      </Section>
      <Section title="기술" count={resume.skills.length}>
        <SkillGroups skills={resume.skills} />
      </Section>
      <Section title="학력" count={resume.educations.length}>
        <div className="space-y-4">
          {resume.educations.map(item => (
            <EducationItem key={item.id} item={item} />
          ))}
        </div>
      </Section>
      <Section title="자격·수상" count={resume.certifications.length}>
        <div className="space-y-4">
          {resume.certifications.map(item => (
            <CertificationItem key={item.id} item={item} />
          ))}
        </div>
      </Section>
    </div>
  )
}
