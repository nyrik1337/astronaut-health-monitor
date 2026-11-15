import type { ApiError } from '../api/errors';

/** Plain-language explanation of a failed AI Companion request. Never shown as an AI answer. */
export function assistantErrorMessage(error: ApiError): string {
  switch (error.code) {
    case 'ASSISTANT_UNAVAILABLE':
      return 'The local AI model is not available. Check that Ollama is running and the Qwen3 4B model is installed.';
    case 'ASSISTANT_BUSY':
      return 'The local AI is still answering another question. Try again in a moment.';
    case 'ASSISTANT_TIMEOUT':
      return 'The local AI took too long to answer and was stopped. Try a shorter question or try again.';
    case 'ASSISTANT_INVALID_RESPONSE':
      return 'The local AI returned an unusable reply, so nothing is shown. Try again.';
    case 'ASSISTANT_CONFIGURATION_ERROR':
      return 'The AI service on the backend is misconfigured.';
    case 'ASSISTANT_NOT_CONNECTED':
      return 'The AI Companion backend is not connected in this build.';
    default:
      break;
  }
  switch (error.kind) {
    case 'network':
      return 'Could not reach the ORBITA backend. Check that it is running.';
    case 'timeout':
      return 'No answer arrived in time. The backend or the local AI may be overloaded.';
    case 'invalid_response':
      return 'The backend reply does not match the AI Companion contract, so nothing is shown.';
    case 'http':
      return error.status === 422
        ? 'The backend rejected the request as invalid for the current assessment context.'
        : `The backend returned an error (HTTP ${error.status ?? '?'}).`;
    default:
      return 'Something went wrong while asking the AI Companion.';
  }
}
