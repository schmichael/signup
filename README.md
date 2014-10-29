## signup

### Running

```sh
go get github.com/schmichael/signup
signup

# Or from within $GOPATH/github.com/schmichael/signup
#go run main.go

# Then in another terminal (if you have httpie and jq installed)
http localhost:8000/api/list
export ITEMID=$(echo '{"description": "Test Item"}' | http POST localhost:8000/api/list | jq .id | sed -e 's/\"//g')
echo '{"user": "me!"}' | http POST localhost:8000/api/list/$ITEMID
```

### API


#### ``GET /api/list/``

Returns:

```json
{
    "list": [
        {"description": "some string", "user": "name if someone signed up"},
        {"description": "again"}
    ]
}
```

#### ``POST /api/list/``

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

#### ``POST /api/list/<id>``

```json
{
    "user": "some string"
}
```
