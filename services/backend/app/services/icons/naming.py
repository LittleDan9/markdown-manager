"""Icon naming utilities for generating human-readable display names."""
import re


# Acronyms to keep uppercase
_ACRONYMS = frozenset({
    'ec2', 'vpc', 'rds', 'ecs', 'eks', 'iam', 'sqs', 'sns', 'api',
    's3', 'cdn', 'dns', 'http', 'https', 'tcp', 'udp', 'ip', 'ssl',
    'tls', 'ssh', 'ftp', 'sql', 'nosql', 'io', 'ai', 'ml', 'ci',
    'cd', 'nlb', 'alb', 'elb', 'nat', 'acm', 'kms', 'waf', 'mq',
    'emr', 'sso', 'ram', 'efs', 'fsx', 'ebs', 'ecr', 'msk', 'dms',
})

# Vendor prefixes to strip (order: longest first)
_VENDOR_PREFIXES = [
    'Arch_Amazon-', 'Arch_AWS-', 'Arch_',
    'Res_Amazon-', 'Res_AWS-', 'Res_',
    'AmazonAWS', 'Amazon_', 'Amazon',
    'AWS_', 'AWS-', 'AWS',
]


def humanize_icon_key(key: str) -> str:
    """Generate a human-readable display name from an icon key.

    Examples:
        AmazonAWSNetworkLoadBalancer -> Network Load Balancer
        ec2 -> EC2
        lambda-function -> Lambda Function
        Arch_Amazon-EC2_48 -> EC2
        flat-color-icons:voicemail -> Voicemail
    """
    name = key

    # Strip trailing size suffixes like _48, _64, _32
    name = re.sub(r'_(?:16|24|32|48|64|128)$', '', name)

    # Strip common vendor prefixes
    for prefix in _VENDOR_PREFIXES:
        if name.startswith(prefix) and len(name) > len(prefix):
            name = name[len(prefix):]
            break

    # Replace hyphens and underscores with spaces
    name = re.sub(r'[-_]', ' ', name)

    # Split PascalCase/camelCase into words
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)

    # Normalize whitespace
    name = re.sub(r'\s+', ' ', name).strip()

    # Title-case each word, keeping known acronyms uppercase
    words = name.split()
    result_words = []
    for w in words:
        if w.lower() in _ACRONYMS:
            result_words.append(w.upper())
        elif w.isupper() and len(w) <= 4:
            result_words.append(w)  # Keep short all-caps as-is
        else:
            result_words.append(w.capitalize())

    return ' '.join(result_words) if result_words else key
