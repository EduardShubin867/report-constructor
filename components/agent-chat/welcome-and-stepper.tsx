import {
  ArrowUpRight,
  CarFront,
  ChartColumn,
  CircleCheckBig,
  FileText,
  MapPinned,
  MessageSquareMore,
  Search,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
} from 'lucide-react';

const welcomeIconProps = { className: 'h-5 w-5', strokeWidth: 1.8 } as const;
const stepIconProps = { className: 'h-4 w-4', strokeWidth: 2 } as const;

export const EXAMPLE_QUERIES = [
  {
    icon: <Users {...welcomeIconProps} />,
    title: 'Отчёт по агентам',
    query: 'Количество договоров и сумма премий по каждому агенту за прошлый месяц',
  },
  {
    icon: <ChartColumn {...welcomeIconProps} />,
    title: 'Динамика премий',
    query: 'Динамика премий по месяцам за текущий год',
  },
  {
    icon: <Trophy {...welcomeIconProps} />,
    title: 'Топ агентов',
    query: 'Топ-20 агентов по заработанной марже',
  },
  {
    icon: <FileText {...welcomeIconProps} />,
    title: 'По конкретному ДГ',
    query: 'Данные по 150 ДГ за текущий год',
  },
  {
    icon: <MapPinned {...welcomeIconProps} />,
    title: 'По территориям',
    query: 'Распределение договоров по территориям в Москве',
  },
  {
    icon: <CarFront {...welcomeIconProps} />,
    title: 'КБМ и тарифы',
    query: 'Средний КБМ и тариф в разрезе марок автомобилей',
  },
];

export const OSAGO_AGENT_EXAMPLE_QUERIES = [
  {
    icon: <MapPinned {...welcomeIconProps} />,
    title: 'Маржинальность региона',
    query: 'Покажи маржинальность Москвы по ОСАГО и графики LR',
  },
  {
    icon: <Users {...welcomeIconProps} />,
    title: 'Анализ агентов',
    query: 'Проанализируй агентов по LR и частоте убытков',
  },
  {
    icon: <Trophy {...welcomeIconProps} />,
    title: 'Крупные выплаты',
    query: 'Покажи топ-10 крупнейших выплат и выводы по ним',
  },
  {
    icon: <CarFront {...welcomeIconProps} />,
    title: 'Сегменты риска',
    query: 'Разбери портфель по КБМ, КВС и пролонгации',
  },
  {
    icon: <ChartColumn {...welcomeIconProps} />,
    title: 'Общий портфель',
    query: 'Дай сводку по всему портфелю ОСАГО',
  },
  {
    icon: <FileText {...welcomeIconProps} />,
    title: 'Убыточные договоры',
    query: 'Найди самые убыточные договоры и объясни причины',
  },
];

export const STEPPER_STEPS = [
  { label: 'Анализ', icon: <Sparkles {...stepIconProps} /> },
  { label: 'Уточнение', icon: <Search {...stepIconProps} /> },
  { label: 'Построение', icon: <MessageSquareMore {...stepIconProps} /> },
  { label: 'Выполнение', icon: <ArrowUpRight {...stepIconProps} /> },
  { label: 'Готово', icon: <CircleCheckBig {...stepIconProps} /> },
];

export const POPULAR_QUERY_ICON = <TrendingUp {...welcomeIconProps} />;

export const STEPPER_STEP_COUNT = STEPPER_STEPS.length;
