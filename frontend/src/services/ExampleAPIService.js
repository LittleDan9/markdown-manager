import { logger } from '../context/LoggerProvider.jsx';

// Create service-specific logger
const apiLogger = logger.createServiceLogger('APIService');

class APIService {
  async fetchDocument(id) {
    apiLogger.debug('Fetching document with ID:', id);

    try {
      const response = await fetch(`/api/documents/${id}`);
      apiLogger.info('Document fetched successfully');
      return response.json();
    } catch (error) {
      apiLogger.error('Failed to fetch document:', error);
      throw error;
    }
  }
}

export default new APIService();
