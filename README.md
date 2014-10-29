signup
======


``GET /api/list/``

Returns:

```json
{
    "list": [
        {"description": "some string", "user": "name if someone signed up"},
        {"description": "again"}
    ]
}
```

POST /api/list/

```json
{
    "description": "some string"
}
```

Returns:

```json
{
    "id": "some string"
}
```

``POST /api/list/<id>``

```json
{
    "user": "some string"
}
```
