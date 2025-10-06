<?php

namespace Drupal\quizren\Service;

use Drupal\Core\Config\ConfigFactoryInterface;
use Drupal\Core\Logger\LoggerChannelFactoryInterface;
use Drupal\Core\Logger\LoggerChannelInterface;
use GuzzleHttp\ClientInterface;
use GuzzleHttp\Exception\RequestException;

/**
 * Service for handling Quiz API requests.
 */
class QuizApiService {

  /**
   * The HTTP client.
   *
   * @var \GuzzleHttp\ClientInterface
   */
  protected $httpClient;

  /**
   * The logger channel.
   *
   * @var \Drupal\Core\Logger\LoggerChannelInterface
   */
  protected $logger;

  /**
   * The config factory.
   *
   * @var \Drupal\Core\Config\ConfigFactoryInterface
   */
  protected $configFactory;

  /**
   * Constructs a QuizApiService object.
   *
   * @param \GuzzleHttp\ClientInterface $http_client
   *   The HTTP client.
   * @param \Drupal\Core\Logger\LoggerChannelFactoryInterface $logger_factory
   *   The logger factory.
   * @param \Drupal\Core\Config\ConfigFactoryInterface $config_factory
   *   The config factory.
   */
  public function __construct(ClientInterface $http_client, LoggerChannelFactoryInterface $logger_factory, ConfigFactoryInterface $config_factory) {
    $this->httpClient = $http_client;
    $this->logger = $logger_factory->get('quizren');
    $this->configFactory = $config_factory;
  }

  /**
   * Fetches quiz data from the API.
   *
   * @param int $nid
   *   The node ID of the quiz.
   *
   * @return array|null
   *   The quiz data array or NULL on failure.
   */
  public function fetchQuizData($nid) {
    try {
      // Get the base URL from global settings.
      $base_url = $GLOBALS['base_url'] ?? 'http://localhost';
      $url = $base_url . '/api/v1/quiz/data';
      
      $response = $this->httpClient->request('GET', $url, [
        'query' => ['nid' => $nid],
        'timeout' => 30,
        'headers' => [
          'Accept' => 'application/json',
          'Content-Type' => 'application/json',
        ],
      ]);

      if ($response->getStatusCode() === 200) {
        $body = $response->getBody()->getContents();
        $data = json_decode($body, TRUE);
        
        if (json_last_error() === JSON_ERROR_NONE) {
          $this->logger->info('Successfully fetched quiz data for node @nid', ['@nid' => $nid]);
          return $data;
        }
        else {
          $this->logger->error('Failed to decode JSON response for node @nid: @error', [
            '@nid' => $nid,
            '@error' => json_last_error_msg(),
          ]);
        }
      }
      else {
        $this->logger->error('API request failed for node @nid with status code @code', [
          '@nid' => $nid,
          '@code' => $response->getStatusCode(),
        ]);
      }
    }
    catch (RequestException $e) {
      $this->logger->error('HTTP request exception for node @nid: @message', [
        '@nid' => $nid,
        '@message' => $e->getMessage(),
      ]);
    }
    catch (\Exception $e) {
      $this->logger->error('Unexpected error fetching quiz data for node @nid: @message', [
        '@nid' => $nid,
        '@message' => $e->getMessage(),
      ]);
    }

    return NULL;
  }

}
