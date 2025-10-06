<?php

namespace Drupal\quizren\Service;

use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use Drupal\Component\Utility\Html;

/**
 * Service for parsing quiz data.
 */
class QuizParserService {

  /**
   * The logger channel.
   *
   * @var \Drupal\Core\Logger\LoggerChannelInterface
   */
  protected $logger;

  /**
   * Constructs a QuizParserService object.
   *
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   */
  public function __construct(LoggerChannelFactoryInterface $logger_factory) {
    $this->logger = $logger_factory->get('quizren');
  }

  /**
   * Parses the field_quiz_data from API response.
   *
   * @param array $api_data
   *   The raw API response data.
   *
   * @return array|null
   *   The parsed quiz questions array or NULL on failure.
   */
  public function parseQuizData(array $api_data) {
    try {
      // The API returns an array with quiz node data.
      if (empty($api_data) || !is_array($api_data)) {
        $this->logger->error('Invalid API data structure received');
        return NULL;
      }

      // Get the first item (should contain the quiz data).
      $quiz_node = reset($api_data);
      
      if (!isset($quiz_node['field_quiz_data'])) {
        $this->logger->error('field_quiz_data not found in API response');
        return NULL;
      }

      // The field_quiz_data contains HTML-encoded JSON string.
      $quiz_data_raw = $quiz_node['field_quiz_data'];
      
      // Decode HTML entities first.
      $quiz_data_decoded = Html::decodeEntities($quiz_data_raw);
      
      // Parse the JSON.
      $quiz_questions = json_decode($quiz_data_decoded, TRUE);
      
      if (json_last_error() !== JSON_ERROR_NONE) {
        $this->logger->error('Failed to parse quiz JSON data: @error', [
          '@error' => json_last_error_msg(),
        ]);
        return NULL;
      }

      // Validate the structure.
      if (!is_array($quiz_questions)) {
        $this->logger->error('Quiz data is not an array');
        return NULL;
      }

      // Process each question to ensure proper structure.
      $processed_questions = [];
      foreach ($quiz_questions as $index => $question) {
        $processed_question = $this->processQuestion($question, $index);
        if ($processed_question) {
          $processed_questions[] = $processed_question;
        }
      }

      $this->logger->info('Successfully parsed @count quiz questions', [
        '@count' => count($processed_questions),
      ]);

      return $processed_questions;
    }
    catch (\Exception $e) {
      $this->logger->error('Unexpected error parsing quiz data: @message', [
        '@message' => $e->getMessage(),
      ]);
      return NULL;
    }
  }

  /**
   * Processes and validates a single question.
   *
   * @param array $question
   *   The raw question data.
   * @param int $index
   *   The question index for logging.
   *
   * @return array|null
   *   The processed question or NULL if invalid.
   */
  protected function processQuestion(array $question, $index) {
    // Validate required fields.
    if (!isset($question['question']) || !isset($question['choices']) || !isset($question['feedback'])) {
      $this->logger->warning('Question @index missing required fields', ['@index' => $index]);
      return NULL;
    }

    // Validate choices structure.
    if (!is_array($question['choices']) || empty($question['choices'])) {
      $this->logger->warning('Question @index has invalid choices', ['@index' => $index]);
      return NULL;
    }

    // Validate feedback structure.
    $feedback = $question['feedback'];
    if (!isset($feedback['correct_feedback']) || !isset($feedback['incorrect_feedback'])) {
      $this->logger->warning('Question @index has invalid feedback structure', ['@index' => $index]);
      return NULL;
    }

    // Process choices to ensure they have required fields.
    $processed_choices = [];
    foreach ($question['choices'] as $choice_index => $choice) {
      if (!isset($choice['id']) || !isset($choice['text']) || !isset($choice['is_correct'])) {
        $this->logger->warning('Question @index, choice @choice_index missing required fields', [
          '@index' => $index,
          '@choice_index' => $choice_index,
        ]);
        continue;
      }
      
      $processed_choices[] = [
        'id' => $choice['id'],
        'text' => $choice['text'],
        'is_correct' => (bool) $choice['is_correct'],
      ];
    }

    if (empty($processed_choices)) {
      $this->logger->warning('Question @index has no valid choices', ['@index' => $index]);
      return NULL;
    }

    return [
      'question' => $question['question'],
      'choices' => $processed_choices,
      'feedback' => [
        'correct_feedback' => $feedback['correct_feedback'],
        'incorrect_feedback' => $feedback['incorrect_feedback'],
      ],
    ];
  }

}
