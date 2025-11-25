"""Test data for architecture diagram parsing."""

# Complete architecture diagram
ARCHITECTURE_COMPLETE = """
architecture-beta
  service input(azure:files)[Input]
  group mft(logos:progress)[Gainwell MFT]
  service sftp(material-icon-theme:folder-content-open)[SFTP] in mft

  group genius(logos:gainwell-arrow-green)[Gainwell Genius]
  service landing(aws:AmazonSimpleStorageServiceS3ObjectLock)[Input Storage] in genius
  service clamav(logos:clamav-logo)[Antivirus] in genius
  service enrich(dbx:data-transformation-ref)[Enrichment] in genius
  service warehouse(dbx:data-warehouse-red)[SQL Warehouse] in genius
  service powerbi(azure:power-bi-embedded)[Power BI] in genius
  service portal(logos:gainwell-arrow-green)[Portal] in genius
  junction junctionPBI in genius

  service user(flat-color-icons:businesswoman)[User]

  input:R --> L:sftp
  sftp:R --> L:landing
  landing:R --> L:clamav
  clamav:R --> L:enrich
  enrich:R --> L:warehouse
  warehouse:R <-- L:portal
  warehouse:T -- B:junctionPBI
  junctionPBI:R --> L:powerbi
  powerbi:B <-- T:portal
  portal:R <-- L:user
"""

# Individual component tests
ARCHITECTURE_SERVICES_ONLY = """
architecture-beta
  service input(azure:files)[Input]
  service sftp(material-icon-theme:folder-content-open)[SFTP]
  service warehouse(dbx:data-warehouse-red)[SQL Warehouse]
"""

ARCHITECTURE_WITH_GROUPS = """
architecture-beta
  group mft(logos:progress)[Gainwell MFT]
  service sftp(material-icon-theme:folder-content-open)[SFTP] in mft
  service landing(aws:AmazonSimpleStorageServiceS3ObjectLock)[Input Storage] in mft
"""

ARCHITECTURE_WITH_JUNCTIONS = """
architecture-beta
  group genius(logos:gainwell-arrow-green)[Gainwell Genius]
  junction junctionPBI in genius
  junction standalone
"""

ARCHITECTURE_EDGE_TYPES = """
architecture-beta
  service A(icon)[Service A]
  service B(icon)[Service B]
  service C(icon)[Service C]
  service D(icon)[Service D]

  A:R --> L:B
  B:T -- B:C
  C:L <-- R:D
  A:B <--> T:D
"""

# Services without groups
ARCHITECTURE_SIMPLE = """
architecture-beta
  service frontend(react)[Frontend App]
  service backend(nodejs)[Backend API]
  service database(postgresql)[Database]

  frontend:R --> L:backend
  backend:R --> L:database
"""

# Mixed service and junction definitions
ARCHITECTURE_MIXED = """
architecture-beta
  service app(docker)[Application]
  junction loadbalancer
  service db1(mysql)[Database 1]
  service db2(mysql)[Database 2]

  app:R --> L:loadbalancer
  loadbalancer:B --> T:db1
  loadbalancer:B --> T:db2
"""