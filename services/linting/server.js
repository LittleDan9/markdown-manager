const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Dynamic import for markdownlint (ES module)
let markdownlint;

async function initializeServer() {
    try {
        const markdownlintModule = await import('markdownlint/sync');
        markdownlint = markdownlintModule.lint;
        console.log('markdownlint sync module loaded successfully');
        
        // Start server after markdownlint is loaded
        startServer();
    } catch (error) {
        console.error('Failed to load markdownlint:', error);
        process.exit(1);
    }
}

function startServer() {
    const app = express();
    const PORT = process.env.MARKDOWN_LINT_PORT || 8002;

    // Load rule definitions and recommended defaults from JSON files
    let ruleDefinitions = {};
    let recommendedDefaults = {};

    try {
        const rulesPath = path.join(__dirname, 'rules-definitions.json');
        const defaultsPath = path.join(__dirname, 'recommended-defaults.json');

        ruleDefinitions = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        recommendedDefaults = JSON.parse(fs.readFileSync(defaultsPath, 'utf8'));

        console.log(`Loaded ${Object.keys(ruleDefinitions).length} rule definitions`);
        console.log(`Loaded recommended defaults for ${Object.keys(recommendedDefaults.rules).length} rules`);
    } catch (error) {
        console.error('Failed to load rule configuration files:', error);
        process.exit(1);
    }

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' })); // Support large markdown files

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'markdown-lint' });
});

// Lint endpoint
app.post('/lint', async (req, res) => {
    try {
        const { text, rules, chunk_offset = 0 } = req.body;

        if (!text || !rules) {
            return res.status(400).json({
                error: 'Missing required fields: text and rules'
            });
        }

        console.log(`Processing lint request - text length: ${text.length}, rules: ${Object.keys(rules).length}`);

        // Configure markdownlint options
        // CRITICAL: markdownlint enables ALL rules by default when a config is provided
        // We need to explicitly disable rules that aren't in the user's configuration
        const allKnownRules = Object.keys(ruleDefinitions);
        const processedConfig = {};

        // Set all known rules to false first
        for (const ruleId of allKnownRules) {
            processedConfig[ruleId] = false;
        }

        // Then enable only the rules that the user wants
        for (const [ruleId, ruleConfig] of Object.entries(rules)) {
            if (ruleConfig !== false) {
                processedConfig[ruleId] = ruleConfig;
            }
        }

        console.log(`Processed config - enabled rules: ${Object.keys(rules).filter(key => rules[key] !== false).join(', ')}`);

        const options = {
            strings: {
                'content': text  // markdownlint expects content as named string
            },
            config: processedConfig
        };

        // Run markdownlint (API changed in v0.40.0)
        const results = markdownlint(options);

        // Parse results into our response format
        const issues = parseMarkdownlintResults(results, chunk_offset);

        console.log(`Found ${issues.length} issues`);

        res.json({
            issues: issues,
            processed_length: text.length,
            rule_count: Object.keys(rules).length
        });

    } catch (error) {
        console.error('Linting error:', error);
        res.status(500).json({
            error: 'Linting failed',
            details: error.message
        });
    }
});

// Get rule definitions endpoint
app.get('/rules/definitions', (req, res) => {
    try {
        res.json({
            rules: ruleDefinitions
        });
    } catch (error) {
        console.error('Failed to get rule definitions:', error);
        res.status(500).json({
            error: 'Failed to get rule definitions',
            details: error.message
        });
    }
});

// Get recommended default rules endpoint
app.get('/rules/recommended-defaults', (req, res) => {
    try {
        res.json(recommendedDefaults);
    } catch (error) {
        console.error('Failed to get recommended defaults:', error);
        res.status(500).json({
            error: 'Failed to get recommended defaults',
            details: error.message
        });
    }
});

// Parse markdownlint results into our API format
function parseMarkdownlintResults(results, chunkOffset) {
    const issues = [];

    // results.content contains array of issues for the 'content' string
    if (results.content) {
        results.content.forEach(issue => {
            const lintIssue = {
                ruleNames: issue.ruleNames || [],
                ruleDescription: issue.ruleDescription || '',
                ruleInformation: issue.ruleInformation || '',
                lineNumber: issue.lineNumber || 1,
                columnNumber: issue.columnNumber || 1,
                fixInfo: issue.fixInfo || null,
                offset: calculateOffset(issue) + chunkOffset,
                length: issue.errorRange ? issue.errorRange[1] : 1,
                severity: 'warning', // markdownlint reports all as warnings
                fixable: isFixable(issue.ruleNames || []),
                errorRange: issue.errorRange || []
            };
            issues.push(lintIssue);
        });
    }

    return issues;
}

// Calculate character offset from line/column
function calculateOffset(issue) {
    const lineNum = issue.lineNumber || 1;
    const colNum = issue.columnNumber || 1;

    // Simplified calculation - in practice might need more precision
    return (lineNum - 1) * 50 + (colNum - 1);
}

// Determine if rule is auto-fixable
function isFixable(ruleNames) {
    const fixableRules = new Set([
        'MD004', 'MD005', 'MD007', 'MD009', 'MD010', 'MD011', 'MD012',
        'MD014', 'MD018', 'MD019', 'MD020', 'MD021', 'MD022', 'MD023',
        'MD026', 'MD027', 'MD030', 'MD031', 'MD032', 'MD034', 'MD037',
        'MD038', 'MD039', 'MD044', 'MD047', 'MD049', 'MD050', 'MD051',
        'MD053', 'MD054', 'MD058'
    ]);

    return ruleNames.some(rule => fixableRules.has(rule));
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Markdown Lint Service running on port ${PORT}`);

    try {
        const markdownlintPkg = require('markdownlint/package.json');
        console.log(`markdownlint library version: ${markdownlintPkg.version}`);
    } catch (error) {
        console.log('markdownlint library loaded successfully');
    }
});
}

// Initialize the server
initializeServer();