// Icon services barrel export
export { default as IconPackManager } from './IconPackManager.js';
export { default as AWSIconLoader } from './AWSIconLoader.js';

// For convenience, also export the singleton instances
import iconPackManagerInstance from './IconPackManager.js';
import awsIconLoaderInstance from './AWSIconLoader.js';

export { iconPackManagerInstance as iconPackManager };
export { awsIconLoaderInstance as awsIconLoader };
export default iconPackManagerInstance;
