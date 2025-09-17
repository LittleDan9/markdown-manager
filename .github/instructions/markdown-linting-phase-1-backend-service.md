---
applyTo: "markdown-lint-service/**/*"
description: "Phase 1: Backend Markdown Lint Service - Dedicated service for markdown processing following PDF service pattern"
---

# Phase 1: Backend Markdown Lint Service

## 🎯 **Phase Objective**

Create a dedicated markdown-lint-service following the established PDF service pattern. This service will handle all markdown linting processing using the Node.js markdownlint library, exposing FastAPI endpoints for the frontend to consume.

## 📋 **Requirements Analysis**

### **Service Architecture Requirements**

1. **Dedicated Container**: Independent service similar to pdf-service
2. **FastAPI Framework**: Consistent with existing service patterns
3. **markdownlint Integration**: Use the full Node.js markdownlint library
4. **Chunked Processing**: Handle large documents by processing text chunks
5. **Rule Application**: Apply custom rule configurations per request
6. **Performance**: Efficient processing for real-time editor feedback

### **API Interface Requirements**

- **POST /lint**: Process text chunks with rule configuration
- **GET /rules/definitions**: Get available markdownlint rule definitions
- **GET /health**: Health check endpoint for monitoring

### **Integration Requirements**

- **Docker Integration**: Service runs in docker-compose stack
- **nginx Routing**: Accessible via nginx proxy (port 8002)
- **Error Handling**: Consistent error responses
- **CORS Support**: Allow frontend cross-origin requests

## 🔧 **Implementation Tasks**

### **Task 1.1: Create Service Structure**

**Directory**: `markdown-lint-service/`

```
markdown-lint-service/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI application
│   ├── lint_service.py          # Core linting logic
│   ├── models.py                # Pydantic request/response models
│   └── config.py                # Service configuration
├── Dockerfile                   # Service containerization
├── requirements.txt             # Python dependencies
└── README.md                    # Service documentation
```

### **Task 1.2: Implement FastAPI Application**

**File**: `markdown-lint-service/app/main.py`

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .models import LintRequest, LintResponse, RuleDefinitionsResponse
from .lint_service import MarkdownLintService
from .config import get_settings
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Markdown Lint Service",
    description="Dedicated service for markdown linting processing",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize lint service
lint_service = MarkdownLintService()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "markdown-lint"}

@app.post("/lint", response_model=LintResponse)
async def lint_text(request: LintRequest):
    """
    Lint markdown text with provided rules
    """
    try:
        issues = await lint_service.lint_text(
            text=request.text,
            rules=request.rules,
            chunk_offset=request.chunk_offset or 0
        )
        
        return LintResponse(
            issues=issues,
            processed_length=len(request.text),
            rule_count=len(request.rules)
        )
    
    except Exception as e:
        logger.error(f"Linting error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Linting failed: {str(e)}")

@app.get("/rules/definitions", response_model=RuleDefinitionsResponse)
async def get_rule_definitions():
    """
    Get all available markdownlint rule definitions
    """
    try:
        definitions = lint_service.get_rule_definitions()
        return RuleDefinitionsResponse(rules=definitions)
    
    except Exception as e:
        logger.error(f"Failed to get rule definitions: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get rule definitions")

if __name__ == "__main__":
    import uvicorn
    settings = get_settings()
    uvicorn.run(app, host="0.0.0.0", port=settings.port)
```

### **Task 1.3: Implement Core Linting Service**

**File**: `markdown-lint-service/app/lint_service.py`

```python
import subprocess
import json
import tempfile
import os
from typing import List, Dict, Any
import asyncio
from .models import LintIssue

class MarkdownLintService:
    """
    Core service for markdown linting using Node.js markdownlint CLI
    """
    
    def __init__(self):
        """Initialize the service and verify markdownlint is available"""
        self._verify_markdownlint()
    
    def _verify_markdownlint(self):
        """Verify that markdownlint CLI is available"""
        try:
            result = subprocess.run(
                ["markdownlint", "--version"], 
                capture_output=True, 
                text=True, 
                check=True
            )
            print(f"markdownlint version: {result.stdout.strip()}")
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            raise RuntimeError(f"markdownlint CLI not available: {e}")
    
    async def lint_text(self, text: str, rules: Dict[str, Any], chunk_offset: int = 0) -> List[LintIssue]:
        """
        Lint markdown text with provided rules
        
        Args:
            text: Markdown text to lint
            rules: Rule configuration dictionary
            chunk_offset: Offset for chunk positioning in larger document
            
        Returns:
            List of lint issues found
        """
        # Create temporary files for processing
        with tempfile.TemporaryDirectory() as temp_dir:
            # Write markdown content to temp file
            md_file = os.path.join(temp_dir, "content.md")
            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(text)
            
            # Write rules configuration to temp file
            config_file = os.path.join(temp_dir, "config.json")
            with open(config_file, 'w', encoding='utf-8') as f:
                json.dump(rules, f)
            
            # Run markdownlint CLI
            try:
                result = await self._run_markdownlint(md_file, config_file)
                issues = self._parse_markdownlint_output(result, chunk_offset)
                return issues
            
            except subprocess.CalledProcessError as e:
                # markdownlint returns non-zero exit code when issues are found
                if e.returncode == 1 and e.stdout:
                    issues = self._parse_markdownlint_output(e.stdout, chunk_offset)
                    return issues
                else:
                    raise RuntimeError(f"markdownlint execution failed: {e.stderr}")
    
    async def _run_markdownlint(self, md_file: str, config_file: str) -> str:
        """Run markdownlint CLI asynchronously"""
        process = await asyncio.create_subprocess_exec(
            "markdownlint",
            "--json",  # JSON output format
            "--config", config_file,
            md_file,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode not in [0, 1]:  # 0 = no issues, 1 = issues found
            raise subprocess.CalledProcessError(
                process.returncode, 
                "markdownlint", 
                output=stdout.decode(),
                stderr=stderr.decode()
            )
        
        return stdout.decode()
    
    def _parse_markdownlint_output(self, output: str, chunk_offset: int) -> List[LintIssue]:
        """Parse markdownlint JSON output into LintIssue objects"""
        try:
            if not output.strip():
                return []
            
            data = json.loads(output)
            issues = []
            
            # markdownlint JSON format: {"filename": [{"lineNumber": ..., "ruleNames": [...], ...}]}
            for filename, file_issues in data.items():
                for issue in file_issues:
                    lint_issue = LintIssue(
                        ruleNames=issue.get("ruleNames", []),
                        ruleDescription=issue.get("ruleDescription", ""),
                        ruleInformation=issue.get("ruleInformation", ""),
                        lineNumber=issue.get("lineNumber", 1),
                        columnNumber=issue.get("columnNumber", 1),
                        offset=chunk_offset + self._calculate_offset(issue, filename),
                        length=issue.get("errorRange", [1])[0] if issue.get("errorRange") else 1,
                        severity="warning",  # markdownlint issues are warnings
                        fixable=self._is_fixable(issue.get("ruleNames", [])),
                        errorContext=issue.get("errorContext", ""),
                        errorDetail=issue.get("errorDetail", ""),
                        errorRange=issue.get("errorRange", [])
                    )
                    issues.append(lint_issue)
            
            return issues
        
        except json.JSONDecodeError as e:
            raise RuntimeError(f"Failed to parse markdownlint output: {e}")
    
    def _calculate_offset(self, issue: Dict, filename: str) -> int:
        """Calculate character offset from line/column information"""
        # This is a simplified calculation - in practice, you'd need to
        # read the file and calculate the actual character offset
        line_num = issue.get("lineNumber", 1)
        col_num = issue.get("columnNumber", 1)
        
        # Rough estimate: assume average 50 chars per line
        # For precise offset calculation, you'd need to process the actual text
        return (line_num - 1) * 50 + (col_num - 1)
    
    def _is_fixable(self, rule_names: List[str]) -> bool:
        """Determine if the issue is auto-fixable"""
        fixable_rules = {
            "MD004", "MD005", "MD007", "MD009", "MD010", "MD011", "MD012",
            "MD014", "MD018", "MD019", "MD020", "MD021", "MD022", "MD023",
            "MD026", "MD027", "MD030", "MD031", "MD032", "MD034", "MD037",
            "MD038", "MD039", "MD044", "MD047", "MD049", "MD050", "MD051",
            "MD053", "MD054", "MD058"
        }
        
        return any(rule in fixable_rules for rule in rule_names)
    
    def get_rule_definitions(self) -> Dict[str, Any]:
        """Get all available markdownlint rule definitions"""
        # This would ideally come from markdownlint CLI or library
        # For now, return the comprehensive rule set
        return {
            "MD001": {"name": "heading-increment", "description": "Heading levels should only increment by one level at a time", "category": "headings"},
            "MD003": {"name": "heading-style", "description": "Heading style should be consistent", "category": "headings"},
            "MD004": {"name": "ul-style", "description": "Unordered list style should be consistent", "category": "lists"},
            # ... (include all 47+ rules as in the frontend service)
        }
```

### **Task 1.4: Define Request/Response Models**

**File**: `markdown-lint-service/app/models.py`

```python
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class LintRequest(BaseModel):
    """Request model for lint endpoint"""
    text: str
    rules: Dict[str, Any]
    chunk_offset: Optional[int] = 0

class LintIssue(BaseModel):
    """Individual lint issue model"""
    ruleNames: List[str]
    ruleDescription: str
    ruleInformation: str
    lineNumber: int
    columnNumber: int
    offset: int
    length: int
    severity: str
    fixable: bool
    errorContext: str
    errorDetail: str
    errorRange: List[int]

class LintResponse(BaseModel):
    """Response model for lint endpoint"""
    issues: List[LintIssue]
    processed_length: int
    rule_count: int

class RuleDefinitionsResponse(BaseModel):
    """Response model for rule definitions endpoint"""
    rules: Dict[str, Any]
```

### **Task 1.5: Create Service Configuration**

**File**: `markdown-lint-service/app/config.py`

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Service configuration"""
    port: int = 8002
    log_level: str = "INFO"
    cors_origins: str = "*"
    
    class Config:
        env_prefix = "MARKDOWN_LINT_"

def get_settings() -> Settings:
    return Settings()
```

### **Task 1.6: Create Dockerfile**

**File**: `markdown-lint-service/Dockerfile`

```dockerfile
FROM python:3.11-slim

# Install Node.js and markdownlint CLI
RUN apt-get update && apt-get install -y \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g markdownlint-cli \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Python requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Run the application
CMD ["python", "-m", "app.main"]
```

### **Task 1.7: Create Requirements File**

**File**: `markdown-lint-service/requirements.txt`

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pydantic-settings==2.1.0
```

### **Task 1.8: Update Docker Compose**

**File**: `docker-compose.yml` (add service)

```yaml
  markdown-lint-service:
    build:
      context: ./markdown-lint-service
      dockerfile: Dockerfile
    environment:
      - MARKDOWN_LINT_PORT=8002
      - MARKDOWN_LINT_LOG_LEVEL=INFO
    ports:
      - "8002:8002"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8002/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

## ✅ **Verification Steps**

1. **Service Startup**: Verify service starts and responds to health checks
2. **API Testing**: Test lint endpoint with sample markdown and rules
3. **Rule Definitions**: Verify rule definitions endpoint returns complete data
4. **Docker Integration**: Confirm service runs properly in docker-compose stack
5. **Performance**: Test processing speed with various document sizes

## 🔗 **Integration Points**

- **Next Phase**: Phase 2 will create frontend API client to consume this service
- **nginx Configuration**: Service accessible via nginx proxy routing
- **Main Backend**: Future integration for rule persistence and user management

## 📊 **Performance Considerations**

- **Async Processing**: FastAPI async endpoints for concurrent request handling
- **Temporary Files**: Efficient cleanup of temporary processing files
- **Error Handling**: Graceful degradation when markdownlint CLI fails
- **Resource Usage**: Monitor memory and CPU usage for optimization

This phase establishes the backend foundation for the entire markdown linting system, providing a robust and scalable service for processing markdown content.