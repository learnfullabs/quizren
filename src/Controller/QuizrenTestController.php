<?php

namespace Drupal\quizren\Controller;

use Drupal\Core\Controller\ControllerBase;
use Drupal\quizren\Service\QuizApiService;
use Drupal\quizren\Service\QuizParserService;
use Symfony\Component\DependencyInjection\ContainerInterface;
use Symfony\Component\HttpFoundation\JsonResponse;

/**
 * Controller for testing Quizren functionality.
 */
class QuizrenTestController extends ControllerBase {

  /**
   * The quiz API service.
   *
   * @var \Drupal\quizren\Service\QuizApiService
   */
  protected $quizApiService;

  /**
   * The quiz parser service.
   *
   * @var \Drupal\quizren\Service\QuizParserService
   */
  protected $quizParserService;

  /**
   * Constructs a QuizrenTestController object.
   *
   * @param \Drupal\quizren\Service\QuizApiService $quiz_api_service
   *   The quiz API service.
   * @param \Drupal\quizren\Service\QuizParserService $quiz_parser_service
   *   The quiz parser service.
   */
  public function __construct(QuizApiService $quiz_api_service, QuizParserService $quiz_parser_service) {
    $this->quizApiService = $quiz_api_service;
    $this->quizParserService = $quiz_parser_service;
  }

  /**
   * {@inheritdoc}
   */
  public static function create(ContainerInterface $container) {
    return new static(
      $container->get('quizren.api_service'),
      $container->get('quizren.parser_service')
    );
  }

  /**
   * Test the quiz API and parser services.
   */
  public function testServices($nid = NULL) {
    $build = [
      '#type' => 'markup',
      '#markup' => '<div id="render"></div>',
    ];

    if ($nid) {
      // Test API service.
      $api_data = $this->quizApiService->fetchQuizData($nid);
      
      if ($api_data) {
        // Test parser service.
        $parsed_data = $this->quizParserService->parseQuizData($api_data);
        
        if ($parsed_data) {
          $this->messenger()->addStatus($this->t('Successfully fetched and parsed quiz data for node @nid. Found @count questions.', [
            '@nid' => $nid,
            '@count' => count($parsed_data),
          ]));
        }
        else {
          $this->messenger()->addError($this->t('Failed to parse quiz data for node @nid.', ['@nid' => $nid]));
        }
      }
      else {
        $this->messenger()->addError($this->t('Failed to fetch quiz data for node @nid.', ['@nid' => $nid]));
      }

      // Add JavaScript to test the frontend.
      $build['#attached']['library'][] = 'quizren/quiz_renderer';
      $build['#attached']['drupalSettings']['quizren']['nid'] = $nid;
      $build['#attached']['drupalSettings']['quizren']['api_endpoint'] = '/api/v1/quiz/data';
    }
    else {
      $build['#markup'] = '<p>Please provide a node ID to test. Example: /admin/config/quizren/test/80</p>';
    }

    return $build;
  }

}
