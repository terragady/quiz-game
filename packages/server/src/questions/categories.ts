import type { Question } from '@quiz/shared';

// Each question source names its categories differently. These map them
// onto the shared set in CATEGORY_ICONS; anything not listed falls back to
// General Knowledge.
const CATEGORY_MAP: Record<string, string> = {
  Geography: 'Geography',
  Europe: 'Geography',
  Flags: 'Geography',
  Landmarks: 'Geography',
  History: 'History',
  Politics: 'History',
  Science: 'Science & Nature',
  'Science & Nature': 'Science & Nature',
  'Science: Mathematics': 'Science & Nature',
  Animals: 'Science & Nature',
  'Science: Computers': 'Technology',
  'Science: Gadgets': 'Technology',
  Vehicles: 'Technology',
  'Entertainment: Video Games': 'Games',
  'Entertainment: Board Games': 'Games',
  'Film And Tv': 'Film & TV',
  'Entertainment: Film': 'Film & TV',
  'Entertainment: Television': 'Film & TV',
  'Entertainment: Cartoon & Animations': 'Film & TV',
  'Entertainment: Japanese Anime & Manga': 'Film & TV',
  Music: 'Music',
  'Entertainment: Music': 'Music',
  'Entertainment: Musicals & Theatres': 'Music',
  'Arts And Literature': 'Arts & Literature',
  'Entertainment: Books': 'Arts & Literature',
  'Entertainment: Comics': 'Arts & Literature',
  Art: 'Arts & Literature',
  Mythology: 'Arts & Literature',
  'Society And Culture': 'Society & Culture',
  Celebrities: 'Society & Culture',
  'Famous People': 'Society & Culture',
  'Food And Drink': 'Food & Drink',
  'Sport And Leisure': 'Sport & Leisure',
  Sports: 'Sport & Leisure',
  'General Knowledge': 'General Knowledge',
  Poland: 'Poland',
  Norway: 'Norway',
};

export function tidyCategory(category: string): string {
  return CATEGORY_MAP[category] ?? 'General Knowledge';
}

export function withTidyCategories(questions: Question[]): Question[] {
  return questions.map((question) => ({
    ...question,
    category: tidyCategory(question.category),
  }));
}
