// Utils services exports
import awsIconLoaderInstance from './AwsIconLoader.js';
import iconPackManagerInstance from './IconPackManager.js';

// Export the singleton instances directly
export { awsIconLoaderInstance as AwsIconLoader };
export { iconPackManagerInstance as IconPackManager };
export const awsIconLoader = awsIconLoaderInstance;
export default iconPackManagerInstance;
