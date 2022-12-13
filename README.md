# Service Pack Update action

This action updates the service pack on creation of a new branch.

## Inputs

### `token`

**Required** The secret github token that authorizes the tagging.

### `path`

The path to the config file containing the year and sp version.

## Example usage

```yaml
uses: MatthiasVandersanden/service-pack-update@v1.0
with:
  token: 'secret-token'
  path: 'path'
```