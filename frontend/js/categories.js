// Shared category taxonomy — used by Dashboard, Transactions, Analytics, Reports, Budget Planner.
const CATEGORIES = {
  income: [
    { id: 'salary', label: 'Salary', icon: '💼', color: '#1B5E4B' },
    { id: 'freelance', label: 'Freelance', icon: '🧑‍💻', color: '#2E7D5C' },
    { id: 'investment', label: 'Investment', icon: '📈', color: '#3E9270' },
    { id: 'gift', label: 'Gift', icon: '🎁', color: '#5EAF8B' },
    { id: 'other_income', label: 'Other', icon: '➕', color: '#7FC4A6' },
  ],
  expense: [
    { id: 'food', label: 'Food & Dining', icon: '🍽️', color: '#A8493E' },
    { id: 'transport', label: 'Transport', icon: '🚗', color: '#C06A4E' },
    { id: 'housing', label: 'Housing', icon: '🏠', color: '#B4933D' },
    { id: 'utilities', label: 'Utilities', icon: '💡', color: '#8A6D2F' },
    { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#9C5B8C' },
    { id: 'health', label: 'Health', icon: '💊', color: '#7A4FA0' },
    { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#4C6FA8' },
    { id: 'education', label: 'Education', icon: '📚', color: '#3E7CB1' },
    { id: 'subscriptions', label: 'Subscriptions', icon: '🔁', color: '#557A99' },
    { id: 'other_expense', label: 'Other', icon: '➖', color: '#8A8378' },
  ]
};

function allCategories() { return [...CATEGORIES.income, ...CATEGORIES.expense]; }
function categoryMeta(id) { return allCategories().find(c => c.id === id) || { label: id, icon: '•', color: '#8A8378' }; }
