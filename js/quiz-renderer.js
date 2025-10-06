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

      // Show loading message.
      renderDiv.innerHTML = '<p>Loading quiz...</p>';

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
     * Renders the quiz HTML.
     */
    renderQuiz: function(quiz, outputDiv) {
      try {
        const quizHtml = quiz.map((q, index) => {
          const questionNumber = index + 1;
          const choicesHtml = q.choices.map(c => 
            `<li>${c.text}</li>`
          ).join('');
          
          return `
            <div class="quiz-question">
              <p><strong>Question ${questionNumber}:</strong> ${q.question}</p>
              <ul class="quiz-choices">${choicesHtml}</ul>
              <div class="quiz-feedback">
                <p><em>Correct:</em> ${q.feedback.correct_feedback}</p>
                <p><em>Incorrect:</em> ${q.feedback.incorrect_feedback}</p>
              </div>
            </div>
          `;
        }).join('<hr class="quiz-separator">');

        outputDiv.innerHTML = `
          <div class="quiz-container">
            <h3>Quiz Questions</h3>
            ${quizHtml}
          </div>
        `;

        // Process MathJax if available.
        this.processMathJax(outputDiv);

        console.log(`QuizRen: Successfully rendered ${quiz.length} questions`);
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
     * Shows an error message.
     */
    showError: function(outputDiv, message) {
      outputDiv.innerHTML = `
        <div class="quiz-error">
          <p><strong>Error:</strong> ${message}</p>
        </div>
      `;
    }
  };

})(Drupal, drupalSettings);
