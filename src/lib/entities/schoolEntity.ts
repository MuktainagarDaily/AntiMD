/**
 * SchoolEntity — first `EntityDef<T>` for a section that has NO
 * bespoke legacy code (Forge Phase 4 milestone).
 *
 * All admin CRUD flows through `<EntityTab/>` + `<SchoolModal/>`.
 * All public rendering flows through `<EntityCard/>`.
 */
import type { EntityDef, EntityColumn } from './types';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  ADMISSION_STATUS_CONFIG,
  MANAGEMENT_TYPE_CONFIG,
  getSchoolResolvedMeta,
  resolveSchoolType,
} from '@/lib/schools/schoolHelpers';
import { BadgeCheck, Check, EyeOff, GraduationCap, KeyRound, MapPin, Phone } from 'lucide-react';
import { createElement } from 'react';

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(SCHOOL_TYPE_CONFIG).map(([k, v]) => [k, v.labelEn])
);

const columns: EntityColumn<SchoolRow>[] = [
  {
    key: 'name',
    header: 'Institute Name',
    render: (s) => {
      const meta = getSchoolResolvedMeta(s);
      const admCfg = meta.admission_status
        ? ADMISSION_STATUS_CONFIG[meta.admission_status]
        : null;

      return createElement(
        'div',
        { className: 'flex items-start gap-2.5 min-w-0 py-0.5' },
        createElement(
          'span',
          {
            className:
              'inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5',
          },
          createElement(GraduationCap, { className: 'w-4 h-4' })
        ),
        createElement(
          'div',
          { className: 'min-w-0' },
          createElement(
            'div',
            { className: 'flex items-center gap-1.5 flex-wrap' },
            createElement(
              'span',
              { className: 'font-semibold text-foreground truncate max-w-[220px] sm:max-w-[280px]' },
              s.name
            ),
            s.is_verified
              ? createElement(
                  'span',
                  {
                    title: 'Verified Institute',
                    className:
                      'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold',
                  },
                  createElement(BadgeCheck, { className: 'w-2.5 h-2.5' }),
                  'Verified'
                )
              : null,
            s.is_claimed
              ? createElement(
                  'span',
                  {
                    title: 'Claimed by Principal / Owner',
                    className:
                      'inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-semibold',
                  },
                  createElement(KeyRound, { className: 'w-2.5 h-2.5' }),
                  'Claimed'
                )
              : null
          ),
          s.name_mr
            ? createElement(
                'div',
                {
                  className: 'text-xs text-muted-foreground truncate font-medium',
                  lang: 'mr',
                },
                s.name_mr
              )
            : null,
          createElement(
            'div',
            { className: 'flex items-center gap-2 flex-wrap mt-0.5' },
            s.phone
              ? createElement(
                  'span',
                  {
                    className: 'text-[11px] text-muted-foreground inline-flex items-center gap-1',
                  },
                  createElement(Phone, { className: 'w-3 h-3 text-primary/70' }),
                  s.phone
                )
              : null,
            meta.udise_aishe_code
              ? createElement(
                  'span',
                  {
                    className:
                      'text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.2 rounded',
                  },
                  `ID: ${meta.udise_aishe_code}`
                )
              : null,
            admCfg && (meta.admission_status === 'open' || meta.admission_status === 'ongoing')
              ? createElement(
                  'span',
                  {
                    className: `md:hidden text-[10px] px-1.5 py-0.2 rounded-full border font-semibold ${admCfg.badgeClass}`,
                  },
                  admCfg.labelEn
                )
              : null
          )
        )
      );
    },
  },
  {
    key: 'type',
    header: 'Category & Admissions',
    hideOnMobile: true,
    render: (s) => {
      const resolvedType = resolveSchoolType(s);
      const typeCfg =
        SCHOOL_TYPE_CONFIG[resolvedType] ||
        SCHOOL_TYPE_CONFIG.other;
      const medCfg = s.medium
        ? SCHOOL_MEDIUM_CONFIG[s.medium as keyof typeof SCHOOL_MEDIUM_CONFIG]
        : null;
      const meta = getSchoolResolvedMeta(s);
      const mgmtCfg = meta.management_type
        ? MANAGEMENT_TYPE_CONFIG[meta.management_type]
        : null;
      const admCfg = meta.admission_status
        ? ADMISSION_STATUS_CONFIG[meta.admission_status]
        : null;

      return createElement(
        'div',
        { className: 'flex flex-col gap-1 items-start' },
        createElement(
          'span',
          {
            className: `text-[11px] px-2 py-0.5 rounded-md font-medium border ${typeCfg.badgeClass}`,
          },
          typeCfg.labelMr
        ),
        createElement(
          'div',
          { className: 'flex items-center gap-1 flex-wrap' },
          medCfg
            ? createElement(
                'span',
                {
                  className: `text-[10px] px-1.5 py-0.2 rounded border ${medCfg.badgeClass}`,
                },
                medCfg.labelMr
              )
            : null,
          mgmtCfg
            ? createElement(
                'span',
                {
                  className: `text-[10px] px-1.5 py-0.2 rounded border ${mgmtCfg.badgeClass}`,
                },
                mgmtCfg.labelEn.split(' / ')[0]
              )
            : null,
          admCfg
            ? createElement(
                'span',
                {
                  className: `text-[10px] px-1.5 py-0.2 rounded-full border font-semibold ${admCfg.badgeClass}`,
                },
                admCfg.labelEn
              )
            : null
        )
      );
    },
  },
  {
    key: 'area',
    header: 'Location / Area',
    hideOnMobile: true,
    render: (s) =>
      createElement(
        'div',
        { className: 'flex items-center gap-1 text-xs text-muted-foreground' },
        createElement(MapPin, { className: 'w-3.5 h-3.5 shrink-0 text-muted-foreground/70' }),
        createElement(
          'span',
          { className: 'truncate max-w-[140px]' },
          [s.area, s.sub_area].filter(Boolean).join(', ') || '—'
        )
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (s) =>
      createElement(
        'span',
        {
          className: `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
            s.is_active
              ? 'bg-success/10 text-success border border-success/30'
              : 'bg-muted text-muted-foreground border border-border'
          }`,
        },
        s.is_active
          ? createElement(Check, { className: 'w-3 h-3' })
          : createElement(EyeOff, { className: 'w-3 h-3' }),
        s.is_active ? ' Active' : ' Disabled'
      ),
  },
];

export const SchoolEntity: EntityDef<SchoolRow> = {
  key: 'school',
  labelSingular: 'Institute',
  labelPlural: 'Institutes',
  listQueryKey: ['admin-schools'],
  listFn: () => schoolsRepo.list(),
  columns,
};

export { TYPE_LABEL as SCHOOL_TYPE_LABEL };
export type { SchoolRow };
