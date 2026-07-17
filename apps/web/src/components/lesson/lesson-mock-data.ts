export type LessonModuleKind =
  | "vocabulary"
  | "grammar"
  | "listening"
  | "practice";

export type LessonActivityKind =
  | "overview"
  | "flashcards"
  | "quiz"
  | "grammar"
  | "fill_blank"
  | "listening"
  | "writing"
  | "reflection";

export type LessonActivity = {
  id: string;
  kind: LessonActivityKind;
  title: string;
  description: string;
  durationMinutes: number;
};

export type LessonModule = {
  id: LessonModuleKind;
  title: string;
  description: string;
  durationMinutes: number;
  activityCount: number;
  objectives: string[];
  activities: LessonActivity[];
};

export type MockQuizQuestion = {
  id: string;
  prompt: string;
  answers: string[];
  correctAnswer: number;
  explanation: string;
};

export const MOCK_LESSON_COURSE = {
  title: "Unit 6 · Lifestyles",
  subtitle: "Xây dựng thói quen tích cực",
  level: "Lớp 8 · Trình độ A2",
  durationMinutes: 35,
  teacher: "Cô Nguyễn Minh Anh",
  version: "GV-01",
  objectives: [
    "Sử dụng được từ vựng về lối sống và thói quen hằng ngày.",
    "So sánh cách thực hiện hành động bằng comparative adverbs.",
    "Nghe và xác định ý chính, thông tin cụ thể trong một đoạn hội thoại ngắn.",
    "Viết đoạn văn 80–100 từ mô tả một thay đổi tích cực trong lối sống.",
  ],
};

export const MOCK_SOURCE_DOCUMENT = {
  name: "English 8 - Unit 6.pdf",
  size: "8,4 MB",
  pageCount: 24,
  language: "Tiếng Anh · Tiếng Việt",
};

export const MOCK_TOPICS = [
  {
    id: "unit-6",
    label: "Unit 6 · Lifestyles",
    description: "Trang 42–51 · Từ vựng, ngữ pháp và hội thoại theo chủ đề",
    confidence: 96,
  },
  {
    id: "communication",
    label: "Communication · Giving opinions",
    description: "Trang 47–48 · Mẫu câu thể hiện và phản hồi ý kiến",
    confidence: 89,
  },
  {
    id: "skills-2",
    label: "Skills 2 · Listening about lifestyle",
    description: "Trang 50–51 · Bài nghe và phần viết phản hồi",
    confidence: 84,
  },
] as const;

export const MOCK_LESSON_MODULES: LessonModule[] = [
  {
    id: "vocabulary",
    title: "Từ vựng theo ngữ cảnh",
    description: "12 từ khóa, phát âm, nghĩa và ví dụ lấy từ tài liệu.",
    durationMinutes: 8,
    activityCount: 3,
    objectives: [
      "Nhận diện 12 từ khóa về lối sống.",
      "Dùng ít nhất 6 từ trong câu có ngữ cảnh.",
    ],
    activities: [
      {
        id: "vocab-context",
        kind: "overview",
        title: "Khởi động từ ngữ cảnh",
        description: "Đọc đoạn trích và nhận diện từ khóa trong tài liệu.",
        durationMinutes: 2,
      },
      {
        id: "vocab-flashcards",
        kind: "flashcards",
        title: "Flashcard · Lifestyle words",
        description: "Học nghĩa, phát âm và ví dụ của 8 từ trọng tâm.",
        durationMinutes: 4,
      },
      {
        id: "vocab-quiz",
        kind: "quiz",
        title: "Quiz nhanh · Chọn từ đúng",
        description: "4 câu trắc nghiệm kiểm tra cách dùng từ theo ngữ cảnh.",
        durationMinutes: 2,
      },
    ],
  },
  {
    id: "grammar",
    title: "Ngữ pháp trọng tâm",
    description: "Cấu trúc so sánh và cách dùng trong tình huống thực tế.",
    durationMinutes: 10,
    activityCount: 2,
    objectives: [
      "Nhận biết comparative adverbs trong câu.",
      "Viết đúng cấu trúc more/less + adverb + than.",
    ],
    activities: [
      {
        id: "grammar-concept",
        kind: "grammar",
        title: "Comparative adverbs",
        description: "Công thức, cách dùng và ví dụ có chú thích.",
        durationMinutes: 4,
      },
      {
        id: "grammar-practice",
        kind: "fill_blank",
        title: "Điền từ · So sánh thói quen",
        description: "Hoàn thành 5 câu bằng dạng đúng của trạng từ.",
        durationMinutes: 6,
      },
    ],
  },
  {
    id: "listening",
    title: "Nghe để nhận diện ý chính",
    description: "Một đoạn nghe ngắn kèm transcript và câu hỏi định hướng.",
    durationMinutes: 7,
    activityCount: 2,
    objectives: [
      "Xác định được chủ đề chính của đoạn nghe.",
      "Ghi lại ít nhất ba thông tin cụ thể về thói quen của nhân vật.",
    ],
    activities: [
      {
        id: "listening-audio",
        kind: "listening",
        title: "Bài nghe · A balanced school day",
        description: "Nghe hai lượt, ghi chú ý chính rồi kiểm tra transcript.",
        durationMinutes: 4,
      },
      {
        id: "listening-quiz",
        kind: "quiz",
        title: "Kiểm tra nghe hiểu",
        description: "4 câu hỏi về ý chính và chi tiết trong bài nghe.",
        durationMinutes: 3,
      },
    ],
  },
  {
    id: "practice",
    title: "Luyện tập tổng hợp",
    description: "Bài tập áp dụng từ vựng và ngữ pháp vừa học.",
    durationMinutes: 10,
    activityCount: 5,
    objectives: [
      "Kết hợp từ vựng, ngữ pháp và thông tin từ bài nghe.",
      "Tạo một sản phẩm viết ngắn có thể được giáo viên phản hồi.",
    ],
    activities: [
      {
        id: "practice-vocab",
        kind: "quiz",
        title: "Ôn tập từ vựng",
        description: "3 câu chọn từ phù hợp với tình huống.",
        durationMinutes: 2,
      },
      {
        id: "practice-grammar",
        kind: "quiz",
        title: "Ôn tập ngữ pháp",
        description: "3 câu chọn cấu trúc so sánh đúng.",
        durationMinutes: 2,
      },
      {
        id: "practice-listening",
        kind: "quiz",
        title: "Nhớ lại bài nghe",
        description: "2 câu nối thông tin với nhân vật.",
        durationMinutes: 1,
      },
      {
        id: "practice-writing",
        kind: "writing",
        title: "Bài viết · My healthier week",
        description: "Viết đoạn văn 80–100 từ theo rubric có sẵn.",
        durationMinutes: 4,
      },
      {
        id: "practice-reflection",
        kind: "reflection",
        title: "Tự đánh giá cuối bài",
        description: "Chọn mức độ tự tin và một việc sẽ áp dụng sau bài học.",
        durationMinutes: 1,
      },
    ],
  },
];

export const MOCK_VOCABULARY = [
  {
    word: "lifestyle",
    pronunciation: "/ˈlaɪfstaɪl/",
    meaning: "lối sống",
    example: "A balanced lifestyle helps you stay healthy and focused.",
  },
  {
    word: "generation",
    pronunciation: "/ˌdʒenəˈreɪʃn/",
    meaning: "thế hệ",
    example: "Each generation develops different daily habits.",
  },
  {
    word: "habit",
    pronunciation: "/ˈhæbɪt/",
    meaning: "thói quen",
    example: "Reading before bed is a useful habit.",
  },
  {
    word: "balanced",
    pronunciation: "/ˈbælənst/",
    meaning: "cân bằng",
    example: "She follows a balanced routine during the school week.",
  },
  {
    word: "community",
    pronunciation: "/kəˈmjuːnəti/",
    meaning: "cộng đồng",
    example: "The community organises outdoor activities every Sunday.",
  },
  {
    word: "routine",
    pronunciation: "/ruːˈtiːn/",
    meaning: "nếp sinh hoạt",
    example: "A clear morning routine helps me arrive at school on time.",
  },
  {
    word: "active",
    pronunciation: "/ˈæktɪv/",
    meaning: "năng động",
    example: "My grandparents remain active by walking every afternoon.",
  },
  {
    word: "screen time",
    pronunciation: "/ˈskriːn taɪm/",
    meaning: "thời gian dùng thiết bị",
    example: "Reducing screen time before bed can improve your sleep.",
  },
];

export const MOCK_CONTEXT_EXCERPT = {
  title: "How our lifestyles are changing",
  paragraphs: [
    "Different generations often follow different routines. Teenagers use digital devices more frequently, while older family members may spend more time in community activities.",
    "A healthy lifestyle does not require a perfect schedule. Small habits such as sleeping regularly, staying active and limiting screen time can create a more balanced week.",
  ],
  highlightedTerms: ["generations", "routines", "healthy lifestyle", "habits", "screen time"],
};

export const MOCK_GRAMMAR = {
  title: "Comparative adverbs",
  formula: "subject + verb + more / less + adverb + than",
  explanation:
    "Dùng comparative adverbs để so sánh cách hai người hoặc hai nhóm thực hiện một hành động.",
  examples: [
    "Teenagers often adapt more quickly than older people.",
    "My brother sleeps less regularly than I do.",
    "People exercise more frequently in the summer.",
    "Lan plans her study time more carefully than last term.",
  ],
  notes: [
    "Với trạng từ ngắn, có thể dùng dạng -er: faster, earlier, harder.",
    "Với trạng từ dài, dùng more/less: more carefully, less frequently.",
    "Sau phần so sánh thường có than + người/vật được so sánh.",
  ],
};

export const MOCK_FILL_BLANKS = [
  {
    id: "blank-1",
    before: "Mai plans her week",
    after: "than she did last month. (carefully)",
    answer: "more carefully",
  },
  {
    id: "blank-2",
    before: "My grandfather wakes up",
    after: "than everyone else. (early)",
    answer: "earlier",
  },
  {
    id: "blank-3",
    before: "We use our phones",
    after: "during exam week. (frequently)",
    answer: "less frequently",
  },
  {
    id: "blank-4",
    before: "The new group works",
    after: "than the previous one. (hard)",
    answer: "harder",
  },
  {
    id: "blank-5",
    before: "Students now communicate",
    after: "with their teachers. (quickly)",
    answer: "more quickly",
  },
];

export const MOCK_LISTENING = {
  title: "A balanced school day",
  duration: "01:24",
  speaker: "Mai, 13 tuổi",
  focusQuestion:
    "Which two habits has Mai improved, and which habit still needs attention?",
  transcript: [
    "Mai starts her day at six thirty and prepares a simple breakfast before school. Last year, she often skipped breakfast and arrived late, but now she plans her mornings more carefully.",
    "After school, Mai takes a short break and then studies for forty minutes. She exercises more regularly than last year because she walks with her sister three evenings a week.",
    "Mai still spends too much time on her phone before going to bed. Her next goal is to stop using screens after ten o’clock so that she can sleep more deeply.",
  ],
  notePrompts: [
    "What changed in Mai’s morning routine?",
    "How often does she walk with her sister?",
    "What is her next lifestyle goal?",
  ],
};

export const MOCK_QUIZZES: Record<string, MockQuizQuestion[]> = {
  "vocab-quiz": [
    {
      id: "vq-1",
      prompt: "Choose the sentence that uses “lifestyle” most naturally.",
      answers: [
        "My lifestyle includes exercise and enough sleep.",
        "I lifestyle to school every morning.",
        "This book is very lifestyle on the table.",
      ],
      correctAnswer: 0,
      explanation: "“Lifestyle” là danh từ chỉ cách một người hoặc nhóm người sống.",
    },
    {
      id: "vq-2",
      prompt: "Which phrase means “nếp sinh hoạt buổi sáng”?",
      answers: ["morning routine", "screen time", "active community"],
      correctAnswer: 0,
      explanation: "“Routine” là một chuỗi hoạt động được lặp lại thường xuyên.",
    },
    {
      id: "vq-3",
      prompt: "What should you reduce before bed to sleep better?",
      answers: ["community", "generation", "screen time"],
      correctAnswer: 2,
      explanation: "Tài liệu khuyên hạn chế screen time trước giờ ngủ.",
    },
    {
      id: "vq-4",
      prompt: "A schedule with study, rest and exercise is described as...",
      answers: ["balanced", "frequent", "digital"],
      correctAnswer: 0,
      explanation: "“Balanced” diễn tả trạng thái cân bằng giữa nhiều phần.",
    },
  ],
  "listening-quiz": [
    {
      id: "lq-1",
      prompt: "What did Mai often skip last year?",
      answers: ["Breakfast", "Homework", "Her evening walk"],
      correctAnswer: 0,
      explanation: "Mai says that she often skipped breakfast last year.",
    },
    {
      id: "lq-2",
      prompt: "How long does Mai study after her short break?",
      answers: ["20 minutes", "40 minutes", "60 minutes"],
      correctAnswer: 1,
      explanation: "The recording states that she studies for forty minutes.",
    },
    {
      id: "lq-3",
      prompt: "Who walks with Mai three evenings a week?",
      answers: ["Her friend", "Her mother", "Her sister"],
      correctAnswer: 2,
      explanation: "Mai walks with her sister three evenings a week.",
    },
    {
      id: "lq-4",
      prompt: "What habit does Mai still want to improve?",
      answers: ["Her screen time", "Her breakfast", "Her school journey"],
      correctAnswer: 0,
      explanation: "Her next goal is to stop using screens after ten o’clock.",
    },
  ],
  "practice-vocab": [
    {
      id: "pv-1",
      prompt: "Complete the phrase: a healthy daily ____.",
      answers: ["routine", "generation", "community"],
      correctAnswer: 0,
      explanation: "“Daily routine” là nếp sinh hoạt hằng ngày.",
    },
    {
      id: "pv-2",
      prompt: "Which word best describes someone who exercises regularly?",
      answers: ["active", "digital", "late"],
      correctAnswer: 0,
      explanation: "An active person regularly moves or exercises.",
    },
    {
      id: "pv-3",
      prompt: "Choose the closest meaning of “habit”.",
      answers: ["A repeated behaviour", "A school subject", "A type of device"],
      correctAnswer: 0,
      explanation: "A habit is something a person does repeatedly.",
    },
  ],
  "practice-grammar": [
    {
      id: "pg-1",
      prompt: "Lan plans her time ____ than last year.",
      answers: ["more carefully", "careful", "most careful"],
      correctAnswer: 0,
      explanation: "Sau động từ “plans” cần trạng từ so sánh “more carefully”.",
    },
    {
      id: "pg-2",
      prompt: "My father wakes up ____ than I do.",
      answers: ["earlier", "more early", "earliest"],
      correctAnswer: 0,
      explanation: "Trạng từ ngắn “early” có dạng so sánh “earlier”.",
    },
    {
      id: "pg-3",
      prompt: "During holidays, I use my laptop ____ than during school weeks.",
      answers: ["more frequently", "frequent", "frequency"],
      correctAnswer: 0,
      explanation: "Cấu trúc đúng là more + adverb + than.",
    },
  ],
  "practice-listening": [
    {
      id: "pl-1",
      prompt: "Which pair shows two habits Mai improved?",
      answers: [
        "Breakfast and exercise",
        "Screen time and sleep",
        "Homework and phone use",
      ],
      correctAnswer: 0,
      explanation: "Mai now eats breakfast and exercises more regularly.",
    },
    {
      id: "pl-2",
      prompt: "Mai wants to stop using screens after...",
      answers: ["8 p.m.", "9 p.m.", "10 p.m."],
      correctAnswer: 2,
      explanation: "Her stated goal is to stop after ten o’clock.",
    },
  ],
};

export const MOCK_WRITING = {
  prompt:
    "Write 80–100 words about one change you want to make for a healthier school week.",
  guidingQuestions: [
    "What habit do you want to change?",
    "Why is this change important?",
    "What three actions will you take?",
    "How will you know that you have improved?",
  ],
  requirements: [
    "Dùng ít nhất 4 từ vựng của Unit 6.",
    "Dùng ít nhất 1 comparative adverb.",
    "Có câu mở đoạn, phần giải thích và câu kết.",
  ],
  rubric: [
    { label: "Đúng chủ đề", points: 2 },
    { label: "Từ vựng Unit 6", points: 3 },
    { label: "Ngữ pháp và liên kết", points: 3 },
    { label: "Chính tả, dấu câu", points: 2 },
  ],
  sampleOutline: [
    "Goal: reduce screen time before bed.",
    "Actions: leave phone outside bedroom, read for 15 minutes, sleep before 10:30.",
    "Expected result: sleep more deeply and wake up earlier.",
  ],
};
