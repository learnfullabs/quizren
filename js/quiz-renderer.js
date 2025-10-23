(function (Drupal, drupalSettings) {
  'use strict';

  /**
   * Quiz renderer behavior.
   */
  Drupal.behaviors.quizRenderer = {
    attach: function (context, settings) {
      // Only run once per page load.
      if (context !== document) {
        return;
      }

      // Check if we have quiz settings.
      if (!settings.quizren || !settings.quizren.nid) {
        console.log('QuizRen: No quiz node ID found in settings');
        return;
      }

      const nid = settings.quizren.nid;
      const apiEndpoint = settings.quizren.api_endpoint || '/api/v1/quiz/data';
      
      // Find the render div.
      const renderDiv = document.getElementById('render');
      if (!renderDiv) {
        console.log('QuizRen: No div#render found on page');
        return;
      }

      // Show loading message with Bootstrap styling.
      renderDiv.innerHTML = `
        <div class="container-fluid">
          <div class="d-flex justify-content-center align-items-center" style="min-height: 200px;">
            <div class="text-center">
              <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
              </div>
              <p class="text-muted">Loading quiz questions...</p>
            </div>
          </div>
        </div>
      `;

      // Fetch quiz data from API.
      this.fetchQuizData(nid, apiEndpoint)
        .then(data => {
          console.log('QuizRen: Raw API data:', data);
          if (data && data.length > 0) {
            const quizData = this.parseQuizData(data);
            console.log('QuizRen: Parsed quiz data:', quizData);
            if (quizData && quizData.length > 0) {
              this.renderQuiz(quizData, renderDiv);
            } else {
              this.showError(renderDiv, 'No valid quiz questions found.');
            }
          } else {
            this.showError(renderDiv, 'No quiz data returned from API.');
          }
        })
        .catch(error => {
          console.error('QuizRen: Error fetching quiz data:', error);
          this.showError(renderDiv, 'Failed to load quiz data. Please try again later.');
        });
    },

    /**
     * Fetches quiz data from the API.
     */
    fetchQuizData: function(nid, apiEndpoint) {
      const url = `${apiEndpoint}?nid=${nid}`;
      
      return fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      });
    },

    /**
     * Parses the quiz data from API response.
     */
    parseQuizData: function(apiData) {
      try {
        if (!Array.isArray(apiData) || apiData.length === 0) {
          console.error('QuizRen: Invalid API data structure');
          return null;
        }

        const quizNode = apiData[0];
        if (!quizNode.field_quiz_data) {
          console.error('QuizRen: field_quiz_data not found in API response');
          return null;
        }

        console.log('QuizRen: Raw field_quiz_data:', quizNode.field_quiz_data);

        // Decode HTML entities and parse JSON.
        const parser = new DOMParser();
        const decodedData = parser.parseFromString(quizNode.field_quiz_data, 'text/html').documentElement.textContent;
        
        console.log('QuizRen: Decoded data:', decodedData);
        
        const quizQuestions = JSON.parse(decodedData);
        
        if (!Array.isArray(quizQuestions)) {
          console.error('QuizRen: Quiz data is not an array');
          return null;
        }

        return quizQuestions;
      } catch (error) {
        console.error('QuizRen: Error parsing quiz data:', error);
        return null;
      }
    },

    /**
     * Decodes HTML entities and fixes LaTeX/MathJax escaping.
     */
    decodeAndFixMath: function(text) {
      if (!text) return text;
      
      // First decode HTML entities
      const parser = new DOMParser();
      let decoded = parser.parseFromString(text, 'text/html').documentElement.textContent;
      
      // Fix all double-escaped backslashes for LaTeX/MathJax
      decoded = decoded.replace(/\\\\/g, '\\');
      
      return decoded;
    },

    /**
     * Renders the quiz HTML using Bootstrap 5 components.
     */
    renderQuiz: function(quiz, outputDiv) {
      try {
        // Store quiz data for answer checking
        this.currentQuiz = quiz;
        
        const quizHtml = quiz.map((q, index) => {
          const questionNumber = index + 1;
          const questionId = `question-${index}`;
          
          // Decode all text content for proper MathJax/LaTeX rendering
          const decodedQuestionText = this.decodeAndFixMath(q.question);
          const decodedCorrectFeedback = this.decodeAndFixMath(q.feedback.correct_feedback);
          const decodedIncorrectFeedback = this.decodeAndFixMath(q.feedback.incorrect_feedback);
          
          // Create Bootstrap list group for choices
          const choicesHtml = q.choices.map((c, choiceIndex) => {
            const choiceId = `${questionId}-choice-${choiceIndex}`;
            // Decode choice text for proper MathJax/LaTeX rendering
            const decodedChoiceText = this.decodeAndFixMath(c.text);
            return `
              <label class="list-group-item list-group-item-action text-muted" role="button" for="${choiceId}">
                <input class="form-check-input me-2" type="radio" name="${questionId}" id="${choiceId}" value="${choiceIndex}" onchange="Drupal.behaviors.quizRenderer.handleChoiceSelection('${questionId}', '${choiceId}')">
                ${decodedChoiceText}
              </label>
            `;
          }).join('');
          
          return `
            <div class="card mb-4 quiz-question-card" data-question="${index}">
              <div class="card-body">
                <p class="card-text text-muted fs-5 mb-3">
                  <span class="badge bg-primary rounded-circle me-2">${questionNumber}</span>
                  ${decodedQuestionText}
                </p>
                
                <div class="list-group mb-3 quiz-choices">
                  ${choicesHtml}
                </div>
                
                <div class="d-grid gap-2 d-md-flex justify-content-md-end">
                  <button type="button" class="btn btn-outline-info btn-sm check-answer-btn" onclick="Drupal.behaviors.quizRenderer.checkAnswer('${questionId}', ${index})">
                    <i class="bi bi-check-circle me-1"></i>Check Answer
                  </button>
                  <button type="button" class="btn btn-primary btn-sm retry-btn" onclick="Drupal.behaviors.quizRenderer.retryQuestion('${questionId}', ${index})" style="display: none;">
                    <i class="bi bi-arrow-clockwise me-1"></i>Retry
                  </button>
                </div>
              </div>
              
              <div class="card-footer quiz-feedback" id="${questionId}-feedback" style="display: none;">
                <div class="alert alert-success mb-0" id="${questionId}-correct-feedback" role="alert" style="display: none;">
                  <strong><i class="bi bi-check-circle-fill me-1"></i>Correct!</strong> ${decodedCorrectFeedback}
                </div>
                <div class="alert alert-danger mb-0" id="${questionId}-incorrect-feedback" role="alert" style="display: none;">
                  <strong><i class="bi bi-x-circle-fill me-1"></i>Incorrect.</strong> ${decodedIncorrectFeedback}
                </div>
              </div>
            </div>
          `;
        }).join('');

        outputDiv.innerHTML = `
          <div class="container-fluid quiz-container">
            <div class="row">
              <div class="col-12">
                <div class="d-flex justify-content-between align-items-center mb-4">
                  <h2 class="h5">
                    Quiz Questions
                  </h2>
                  <span class="badge bg-secondary fs-6">${quiz.length} Questions</span>
                </div>
                ${quizHtml}
                
                <div class="card border-success d-none">
                  <div class="card-body text-center">
                    <button type="button" class="btn btn-success btn-lg" onclick="Drupal.behaviors.quizRenderer.submitQuiz()">
                      <i class="bi bi-send me-2"></i>Submit Quiz
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

        // Process MathJax if available.
        this.processMathJax(outputDiv);

        console.log(`QuizRen: Successfully rendered ${quiz.length} questions with Bootstrap 5 styling`);
      } catch (error) {
        console.error('QuizRen: Error rendering quiz:', error);
        this.showError(outputDiv, 'Error rendering quiz questions.');
      }
    },

    /**
     * Process MathJax for the rendered content.
     */
    processMathJax: function(element) {
      if (typeof MathJax !== 'undefined') {
        try {
          // MathJax v4/v3 syntax
          if (MathJax.typesetPromise) {
            MathJax.typesetPromise([element]).then(() => {
              console.log('QuizRen: MathJax v4/v3 typesetting completed');
            }).catch((err) => {
              console.warn('QuizRen: MathJax typesetting error:', err);
            });
          }
          // Simple typeset call (fallback for v3)
          else if (MathJax.typeset) {
            MathJax.typeset([element]);
            console.log('QuizRen: MathJax typeset called');
          }
          // MathJax v2 syntax (legacy fallback)
          else if (MathJax.Hub && MathJax.Hub.Queue) {
            MathJax.Hub.Queue(['Typeset', MathJax.Hub, element]);
            console.log('QuizRen: MathJax v2 typesetting queued');
          }
        } catch (error) {
          console.warn('QuizRen: Error processing MathJax:', error);
        }
      } else {
        console.log('QuizRen: MathJax not available - math expressions may not render properly');
      }
    },

    /**
     * Shows an error message using Bootstrap alert.
     */
    showError: function(outputDiv, message) {
      outputDiv.innerHTML = `
        <div class="container-fluid">
          <div class="alert alert-danger" role="alert">
            <i class="bi bi-exclamation-triangle-fill me-2"></i>
            <strong>Error:</strong> ${message}
          </div>
        </div>
      `;
    },

    /**
     * Handles choice selection styling.
     */
    handleChoiceSelection: function(questionId, selectedChoiceId) {
      // Remove bg-primary-subtle from all choices in this question
      const allChoicesInQuestion = document.querySelectorAll(`input[name="${questionId}"]`);
      allChoicesInQuestion.forEach(input => {
        const label = input.closest('label');
        if (label) {
          label.classList.remove('bg-primary-subtle');
        }
      });

      // Add bg-primary-subtle to the selected choice
      const selectedInput = document.getElementById(selectedChoiceId);
      if (selectedInput) {
        const selectedLabel = selectedInput.closest('label');
        if (selectedLabel) {
          selectedLabel.classList.add('bg-primary-subtle');
        }
      }
    },


    /**
     * Checks the answer for a specific question.
     */
    checkAnswer: function(questionId, questionIndex) {
      const selectedChoice = document.querySelector(`input[name="${questionId}"]:checked`);
      const questionCard = document.querySelector(`[data-question="${questionIndex}"]`);
      
      if (!selectedChoice) {
        this.showToast('Please select an answer first!', 'warning');
        return;
      }

      if (!this.currentQuiz || !this.currentQuiz[questionIndex]) {
        console.error('QuizRen: Quiz data not available for answer checking');
        return;
      }

      const selectedChoiceIndex = parseInt(selectedChoice.value);
      const question = this.currentQuiz[questionIndex];
      const selectedChoiceData = question.choices[selectedChoiceIndex];
      const isCorrect = selectedChoiceData && selectedChoiceData.is_correct;

      // Show feedback container
      const feedbackDiv = document.getElementById(`${questionId}-feedback`);
      if (feedbackDiv) {
        feedbackDiv.style.display = 'block';
      }

      // Show appropriate feedback based on correctness
      const correctFeedbackDiv = document.getElementById(`${questionId}-correct-feedback`);
      const incorrectFeedbackDiv = document.getElementById(`${questionId}-incorrect-feedback`);
      
      const checkButton = questionCard.querySelector('.check-answer-btn');
      const retryButton = questionCard.querySelector('.retry-btn');
      
      if (isCorrect) {
        if (correctFeedbackDiv) correctFeedbackDiv.style.display = 'block';
        if (incorrectFeedbackDiv) incorrectFeedbackDiv.style.display = 'none';
        
        // Add success styling to card
        questionCard.classList.remove('border-danger', 'border-info');
        questionCard.classList.add('border-success');
        
        // Update check button to show success
        if (checkButton) {
          checkButton.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i>Correct!';
          checkButton.classList.remove('btn-outline-info');
          checkButton.classList.add('btn-success', 'text-white');
          checkButton.disabled = true;
        }
        
        // Disable further selection for this question
        const allChoices = document.querySelectorAll(`input[name="${questionId}"]`);
        allChoices.forEach(choice => choice.disabled = true);
        
        this.showToast('Correct answer! 🎉', 'success');
      } else {
        if (correctFeedbackDiv) correctFeedbackDiv.style.display = 'none';
        if (incorrectFeedbackDiv) incorrectFeedbackDiv.style.display = 'block';
        
        // Add error styling to card
        questionCard.classList.remove('border-success', 'border-info');
        questionCard.classList.add('border-danger');
        
        // Hide check button and show retry button
        if (checkButton) {
          checkButton.style.display = 'none';
        }
        if (retryButton) {
          retryButton.style.display = 'inline-block';
        }
        
        // Disable further selection for this question (until retry)
        const allChoices = document.querySelectorAll(`input[name="${questionId}"]`);
        allChoices.forEach(choice => choice.disabled = true);
        
        this.showToast('Incorrect answer. Click Retry to try again!', 'warning');
      }

      // Process MathJax for the newly shown feedback
      this.processMathJax(feedbackDiv);
    },

    /**
     * Resets a question to allow retry.
     */
    retryQuestion: function(questionId, questionIndex) {
      const questionCard = document.querySelector(`[data-question="${questionIndex}"]`);
      const checkButton = questionCard.querySelector('.check-answer-btn');
      const retryButton = questionCard.querySelector('.retry-btn');
      const feedbackDiv = document.getElementById(`${questionId}-feedback`);
      
      // Reset visual styling
      questionCard.classList.remove('border-success', 'border-danger', 'border-info');
      
      // Hide feedback
      if (feedbackDiv) {
        feedbackDiv.style.display = 'none';
      }
      
      // Reset button visibility
      if (checkButton) {
        checkButton.style.display = 'inline-block';
        checkButton.innerHTML = '<i class="bi bi-check-circle me-1"></i>Check Answer';
        checkButton.classList.remove('btn-outline-info', 'btn-danger');
        checkButton.classList.add('btn-outline-info');
        checkButton.disabled = false;
      }
      if (retryButton) {
        retryButton.style.display = 'none';
      }
      
      // Re-enable all choices and clear selection
      const allChoices = document.querySelectorAll(`input[name="${questionId}"]`);
      allChoices.forEach(choice => {
        choice.disabled = false;
        choice.checked = false;
        
        // Remove selection styling from labels
        const label = choice.closest('label');
        if (label) {
          label.classList.remove('bg-primary-subtle');
        }
      });
      
      this.showToast('Question reset. Try again!', 'info');
    },

    /**
     * Submits the entire quiz.
     */
    submitQuiz: function() {
      const allQuestions = document.querySelectorAll('.quiz-question-card');
      let answeredCount = 0;
      
      allQuestions.forEach(card => {
        const questionIndex = card.getAttribute('data-question');
        const selectedChoice = document.querySelector(`input[name="question-${questionIndex}"]:checked`);
        if (selectedChoice) {
          answeredCount++;
        }
      });

      if (answeredCount === 0) {
        this.showToast('Please answer at least one question before submitting!', 'warning');
        return;
      }

      if (answeredCount < allQuestions.length) {
        const proceed = confirm(`You have answered ${answeredCount} out of ${allQuestions.length} questions. Do you want to submit anyway?`);
        if (!proceed) {
          return;
        }
      }

      // Show all feedback
      allQuestions.forEach(card => {
        const questionIndex = card.getAttribute('data-question');
        const feedbackDiv = document.getElementById(`question-${questionIndex}-feedback`);
        if (feedbackDiv) {
          feedbackDiv.style.display = 'block';
        }
      });

      this.showToast(`Quiz submitted! You answered ${answeredCount} out of ${allQuestions.length} questions.`, 'success');
    },

    /**
     * Shows a Bootstrap toast notification.
     */
    showToast: function(message, type = 'info') {
      // Create toast container if it doesn't exist
      let toastContainer = document.getElementById('quiz-toast-container');
      if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'quiz-toast-container';
        toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
        toastContainer.style.zIndex = '1055';
        document.body.appendChild(toastContainer);
      }

      const toastId = `toast-${Date.now()}`;
      const bgClass = type === 'success' ? 'bg-success' : type === 'warning' ? 'bg-warning' : 'bg-info';
      
      const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert" aria-live="assertive" aria-atomic="true">
          <div class="toast-body">
            ${message}
          </div>
        </div>
      `;

      toastContainer.insertAdjacentHTML('beforeend', toastHtml);
      
      const toastElement = document.getElementById(toastId);
      const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 3000
      });
      
      toast.show();
      
      // Remove toast element after it's hidden
      toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
      });
    }
  };

})(Drupal, drupalSettings);
