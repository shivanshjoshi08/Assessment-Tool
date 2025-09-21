document.addEventListener('DOMContentLoaded', () => {
    // --- API Configuration ---
    const API_KEY = "AIzaSyCTgTt6z-z1AMClq70fJbaSZWBn7NVW4YI"; // IMPORTANT: Make sure your API key is here
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // --- Global Variables ---
    let shuffledQuestions, currentQuestionIndex, score, timerInterval;
    let incorrectlyAnsweredQuestions = [];
    let questionStates = [];
    let totalQuizQuestions = 10;
    let timeLeft = 600;
    let selectedDifficulty = 'medium';
    let selectedCategory = '';

    // --- DOM Element References ---
    const setupAreaEl = document.getElementById('setup-area');
    const quizAreaEl = document.getElementById('quiz-area');
    const resultsAreaEl = document.getElementById('results-area');
    const loadingAreaEl = document.getElementById('loading-area');
    const quizContentEl = document.getElementById('quiz-content');
    const questionPaletteEl = document.getElementById('question-palette');
    const questionNumberEl = document.getElementById('question-number');
    const questionTextEl = document.getElementById('question-text');
    const answerButtonsEl = document.getElementById('answer-buttons');
    const nextBtn = document.getElementById('next-btn');
    const attemptLaterBtn = document.getElementById('attempt-later-btn');
    const submitQuizBtn = document.getElementById('submit-quiz-btn');
    const scoreTextEl = document.getElementById('score-text');
    const totalQuestionsEl = document.getElementById('total-questions');
    const resultMessageEl = document.getElementById('result-message');
    const difficultyButtons = document.getElementById('difficulty-buttons');
    const startBtn = document.getElementById('start-btn');
    const restartBtn = document.getElementById('restart-btn');
    const timerEl = document.getElementById('timer');
    const explainBtn = document.getElementById('explain-btn');
    const explanationModalEl = document.getElementById('explanation-modal');
    const explanationContentEl = document.getElementById('explanation-content');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const feedbackBtn = document.getElementById('feedback-btn');
    const feedbackResponseEl = document.getElementById('feedback-response');
    const submitModalEl = document.getElementById('submit-modal');
    const submitModalTextEl = document.getElementById('submit-modal-text');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const cancelSubmitBtn = document.getElementById('cancel-submit-btn');
    const progressCircleBar = document.getElementById('progress-circle-bar');
    const minusBtn = document.getElementById('minus-btn');
    const plusBtn = document.getElementById('plus-btn');
    const numQuestionsDisplayEl = document.getElementById('num-questions-display');
    const wrapper = document.querySelector('.custom-select-wrapper');
    const trigger = document.querySelector('.custom-select-trigger');
    const options = document.querySelectorAll('.custom-option');
    const selectedText = document.getElementById('selected-category-text');

    // --- API Call Function ---
    async function callGeminiAPI(prompt, expectJson = false) {
        if (!API_KEY) {
            alert("API Key is missing. Please add your Gemini API Key in script.js");
            return null;
        }
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            ...(expectJson && {
                generationConfig: { responseMimeType: "application/json" }
            })
        };
        try {
            const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API call failed with status: ${response.status}`);
            const result = await response.json();
            return result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't get a response.";
        } catch (error) {
            console.error("Gemini API call error:", error);
            return null;
        }
    }

    // --- Core Functions ---
    async function startQuiz() {
    // 1. Validation check
    if (!wrapper.dataset.selectedValue) {
        alert("Please select a category before starting.");
        return;
    }

    switchScreen(quizAreaEl);
    quizContentEl.classList.add('hidden');
    loadingAreaEl.classList.remove('hidden');
    startBtn.disabled = true;

    selectedCategory = wrapper.dataset.selectedText || '';
    totalQuizQuestions = parseInt(numQuestionsDisplayEl.textContent);
    timeLeft = totalQuizQuestions * 60;
    
    const historyKey = `quizHistory_${selectedCategory.replace(/\s/g, '')}_${selectedDifficulty}`;
    let history = JSON.parse(localStorage.getItem(historyKey)) || [];
    let exclusionPrompt = "";
    if (history.length > 0) {
        const questionsToExclude = history.join('"\n- "');
        exclusionPrompt = `\n\nIMPORTANT: To ensure variety, do not generate any questions from this list:\n- "${questionsToExclude}"`;
    }
    
    const prompt = `Generate ${totalQuizQuestions} unique, new multiple-choice questions for an assessment quiz. The category is '${selectedCategory}'. The difficulty is '${selectedDifficulty}'. Provide the output in a valid JSON format. The JSON must be an array of objects. Each object must have two keys: 'question' (a string) and 'answers' (an array of exactly 4 objects). Each object in the 'answers' array must have two keys: 'text' (a string) and 'correct' (a boolean). For each question, ensure that exactly one answer has 'correct' set to true.${exclusionPrompt}`;

    const questionsJsonString = await callGeminiAPI(prompt, true);
    startBtn.disabled = false;

    if (!questionsJsonString) {
        alert("Failed to generate questions. Please try again.");
        goHome();
        return;
    }

    try {
        // --- NEW ROBUST PARSING LOGIC ---
        // This will clean the AI's response before trying to read it.
        let cleanJsonString = questionsJsonString;
        const startIndex = cleanJsonString.indexOf('[');
        const endIndex = cleanJsonString.lastIndexOf(']');

        if (startIndex !== -1 && endIndex !== -1) {
            cleanJsonString = cleanJsonString.substring(startIndex, endIndex + 1);
        }
        // --- END OF NEW LOGIC ---

        shuffledQuestions = JSON.parse(cleanJsonString); // Use the cleaned string
        
        if (!Array.isArray(shuffledQuestions) || shuffledQuestions.length < totalQuizQuestions) {
            throw new Error("Invalid or insufficient questions received from API.");
        }
    } catch (e) {
        console.error("Failed to parse questions from API:", e, "Original response:", questionsJsonString);
        alert("An error occurred while preparing the quiz. Please try again.");
        goHome();
        return;
    }
    
    // Save to history and continue...
    const newQuestionTexts = shuffledQuestions.map(q => q.question);
    let updatedHistory = [...new Set([...history, ...newQuestionTexts])];
    if (updatedHistory.length > 50) {
        updatedHistory = updatedHistory.slice(updatedHistory.length - 50);
    }
    localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
    
    loadingAreaEl.classList.add('hidden');
    quizContentEl.classList.remove('hidden');
    
    // Update UI and start quiz...
    const categoryDisplayEl = document.getElementById('test-category-display');
    const difficultyDisplayEl = document.getElementById('test-difficulty-display');
    categoryDisplayEl.innerHTML = `&#128204; Category: <strong>${selectedCategory}</strong>`;
    difficultyDisplayEl.textContent = selectedDifficulty;
    difficultyDisplayEl.className = 'difficulty-tag';
    difficultyDisplayEl.classList.add(`difficulty-${selectedDifficulty}`);
    
    questionStates = Array(shuffledQuestions.length).fill('unanswered');
    currentQuestionIndex = 0;
    score = 0;
    incorrectlyAnsweredQuestions = [];
    
    clearInterval(timerInterval);
    feedbackBtn.disabled = false;
    feedbackResponseEl.classList.add('hidden');
    
    createPalette();
    startTimer();
    showQuestion(0);
}
    
    // --- All other functions (updateQuestionCountButtons, switchScreen, createPalette, etc.) ---
    function updateQuestionCountButtons() {
        const currentVal = parseInt(numQuestionsDisplayEl.textContent);
        minusBtn.disabled = currentVal <= 5;
        plusBtn.disabled = currentVal >= 30;
    }
    function switchScreen(activeScreen) {
        document.querySelectorAll('.screen').forEach(screen => {
            if (screen !== activeScreen) screen.classList.add('hidden');
        });
        activeScreen.classList.remove('hidden');
    }
    function createPalette() {
        questionPaletteEl.innerHTML = '';
        shuffledQuestions.forEach((_, i) => {
            const button = document.createElement('button');
            button.innerText = i + 1;
            button.classList.add('palette-btn');
            button.addEventListener('click', () => showQuestion(i));
            questionPaletteEl.appendChild(button);
        });
    }
    function updatePalette() {
        const paletteButtons = questionPaletteEl.children;
        for (let i = 0; i < paletteButtons.length; i++) {
            paletteButtons[i].classList.remove('current', 'answered', 'marked');
            switch (questionStates[i]) {
                case 'answered': paletteButtons[i].classList.add('answered'); break;
                case 'marked': paletteButtons[i].classList.add('marked'); break;
            }
            if (i === currentQuestionIndex) paletteButtons[i].classList.add('current');
        }
    }
    function showQuestion(index) {
        currentQuestionIndex = index;
        resetState();
        updatePalette();
        const currentQuestion = shuffledQuestions[index];
        questionNumberEl.innerText = `Question ${index + 1}/${shuffledQuestions.length}`;
        questionTextEl.innerText = currentQuestion.question;
        currentQuestion.answers.forEach(answer => {
            const button = document.createElement('button');
            button.innerText = answer.text;
            button.classList.add('btn-option');
            if (answer.correct) button.dataset.correct = "true";
            button.addEventListener('click', selectAnswer);
            answerButtonsEl.appendChild(button);
        });
    }
    function selectAnswer(e) {
        if (questionStates[currentQuestionIndex] === 'answered') return;
        const selectedBtn = e.target;
        const isCorrect = selectedBtn.dataset.correct === "true";
        if (isCorrect) {
            score++;
        } else {
            incorrectlyAnsweredQuestions.push({ ...shuffledQuestions[currentQuestionIndex], selectedAnswer: selectedBtn.innerText });
        }
        questionStates[currentQuestionIndex] = 'answered';
        updatePalette();
        Array.from(answerButtonsEl.children).forEach(button => {
            if (button.dataset.correct === "true") button.classList.add('correct');
            else if (button === selectedBtn) button.classList.add('incorrect');
            button.disabled = true;
        });
        explainBtn.classList.remove('hidden');
        attemptLaterBtn.disabled = true;
    }
    function showResults() {
        clearInterval(timerInterval);
        submitModalEl.classList.add('hidden');
        switchScreen(resultsAreaEl);
        scoreTextEl.innerText = score;
        totalQuestionsEl.innerText = shuffledQuestions.length;
        const radius = 42;
        const circumference = 2 * Math.PI * radius;
        const percentage = (shuffledQuestions.length > 0) ? (score / shuffledQuestions.length) : 0;
        progressCircleBar.style.strokeDashoffset = circumference * (1 - percentage);
        let message = "";
        if (percentage >= 0.8) message = "Excellent work! You are well prepared.";
        else if (percentage >= 0.6) message = "Good job! A little more practice will make you perfect.";
        else message = "Keep practicing! Focus on your weak areas.";
        resultMessageEl.innerText = message;
    }
    function findNextQuestion() {
        let nextIndex = -1;
        for (let i = currentQuestionIndex + 1; i < shuffledQuestions.length; i++) {
            if (questionStates[i] !== 'answered') { nextIndex = i; break; }
        }
        if (nextIndex === -1) {
            for (let i = 0; i < currentQuestionIndex; i++) {
                if (questionStates[i] !== 'answered') { nextIndex = i; break; }
            }
        }
        if (nextIndex !== -1) showQuestion(nextIndex);
        else handleSubmitQuiz();
    }
    function handleAttemptLater() {
        questionStates[currentQuestionIndex] = 'marked';
        updatePalette();
        findNextQuestion();
    }
    function handleSubmitQuiz() {
        const unansweredCount = questionStates.filter(s => s === 'unanswered' || s === 'marked').length;
        if (unansweredCount > 0) {
            submitModalTextEl.innerText = `You have ${unansweredCount} unanswered questions. Are you sure you want to submit?`;
            submitModalEl.classList.remove('hidden');
        } else {
            showResults();
        }
    }
    function goHome() {
        switchScreen(setupAreaEl);
        startBtn.disabled = false;
    }
    function resetState() {
        explainBtn.classList.add('hidden');
        attemptLaterBtn.disabled = false;
        while (answerButtonsEl.firstChild) {
            answerButtonsEl.removeChild(answerButtonsEl.firstChild);
        }
    }
    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                showResults();
            }
        }, 1000);
    }
    async function getExplanation() {
        explanationModalEl.classList.remove('hidden');
        explanationContentEl.innerHTML = '<div class="loader-container" style="height: 10rem;"><div class="loader"></div></div>';
        const currentQuestion = shuffledQuestions[currentQuestionIndex];
        const options = currentQuestion.answers.map(a => a.text).join(', ');
        const correctAnswer = currentQuestion.answers.find(a => a.correct).text;
        const prompt = `Explain the solution for the following multiple-choice question in simple English. Keep the explanation brief and to the point (2-3 sentences).\nQuestion: "${currentQuestion.question}"\nOptions: ${options}\nThe correct answer is: "${correctAnswer}"`;
        const explanation = await callGeminiAPI(prompt);
        explanationContentEl.innerText = explanation;
    }
    async function getFeedback() {
        feedbackBtn.disabled = true;
        feedbackResponseEl.classList.remove('hidden');
        feedbackResponseEl.innerHTML = '<div class="loader-container" style="height: 5rem;"><div class="loader"></div></div>';
        if (score === shuffledQuestions.length && shuffledQuestions.length > 0) {
            feedbackResponseEl.innerText = "Fantastic! You answered all questions correctly. Keep up the great work!";
            return;
        }
        const incorrectQsString = incorrectlyAnsweredQuestions.map(q => `- Question: "${q.question}" (Your answer: "${q.selectedAnswer}")`).join('\n');
        const prompt = `I took a skills quiz and scored ${score} out of ${shuffledQuestions.length}. I got these questions wrong:\n${incorrectQsString}\nBased on these mistakes, identify my weak areas and give me 2-3 specific, actionable tips to improve. Keep the feedback encouraging and concise in simple English.`;
        const feedback = await callGeminiAPI(prompt);
        if (feedback) {
            feedbackResponseEl.innerText = feedback;
        } else {
            feedbackResponseEl.innerText = "Sorry, personalized feedback could not be generated at this time. Please check the developer console for errors and try again later.";
        }
    }

    // --- Event Listeners ---
    updateQuestionCountButtons();
    minusBtn.addEventListener('click', () => {
        let currentVal = parseInt(numQuestionsDisplayEl.textContent);
        if (currentVal > 5) numQuestionsDisplayEl.textContent = currentVal - 1;
        updateQuestionCountButtons();
    });
    plusBtn.addEventListener('click', () => {
        let currentVal = parseInt(numQuestionsDisplayEl.textContent);
        if (currentVal < 30) numQuestionsDisplayEl.textContent = currentVal + 1;
        updateQuestionCountButtons();
    });
    difficultyButtons.addEventListener('click', (e) => {
        if (e.target.classList.contains('difficulty-btn')) {
            selectedDifficulty = e.target.dataset.difficulty;
            document.querySelector('.difficulty-btn.selected').classList.remove('selected');
            e.target.classList.add('selected');
        }
    });
    startBtn.addEventListener('click', startQuiz);
    nextBtn.addEventListener('click', findNextQuestion);
    attemptLaterBtn.addEventListener('click', handleAttemptLater);
    submitQuizBtn.addEventListener('click', handleSubmitQuiz);
    restartBtn.addEventListener('click', goHome);
    explainBtn.addEventListener('click', getExplanation);
    closeModalBtn.addEventListener('click', () => explanationModalEl.classList.add('hidden'));
    feedbackBtn.addEventListener('click', getFeedback);
    confirmSubmitBtn.addEventListener('click', () => {
        showResults();
        submitModalEl.classList.add('hidden');
    });
    cancelSubmitBtn.addEventListener('click', () => submitModalEl.classList.add('hidden'));

    // --- Custom Dropdown Logic ---
    trigger.addEventListener('click', () => wrapper.classList.toggle('open'));
    window.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) wrapper.classList.remove('open');
    });
    options.forEach(option => {
        option.addEventListener('click', function () {
            wrapper.dataset.selectedValue = this.dataset.value;
            wrapper.dataset.selectedText = this.textContent;
            selectedText.textContent = this.textContent;
            options.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            wrapper.classList.remove('open');
        });
    });
});