package main

import (
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path"
	"time"

	"github.com/gorilla/mux"
	_ "github.com/mattn/go-sqlite3"
)

func init() {
	rand.Seed(time.Now().UnixNano())
}

var DB *sql.DB

type Item struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	User        string `json:"user,omitempty"`
}

func addHeaders(rw http.ResponseWriter) {
	rw.Header().Add("Access-Control-Allow-Origin", "http://localhost:8080")
	rw.Header().Add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
	rw.Header().Add("Access-Control-Allow-Headers", "Content-Type")
	rw.Header().Add("Access-Control-Allow-Credentials", "true")
	rw.Header().Add("Content-Type", "application/json")
}

func GetHandler(rw http.ResponseWriter, req *http.Request) {
	addHeaders(rw)
	if req.Method == "OPTIONS" {
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Error begining transaction: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		return
	}
	defer tx.Rollback()

	cur, err := tx.Query("SELECT * FROM items")
	if err != nil {
		log.Printf("Error retrieving list: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		return
	}

	var items []*Item

	for cur.Next() {
		item := &Item{}
		if err := cur.Scan(&item.ID, &item.Description, &item.User); err != nil {
			log.Printf("Error retrieving item: %v", err)
			rw.WriteHeader(500)
			rw.Write([]byte("oops"))
			return
		}
		items = append(items, item)
	}

	resp := &struct {
		List []*Item `json:"list"`
	}{List: items}
	body, err := json.Marshal(resp)
	if err != nil {
		log.Printf("Error marshalling items: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		return
	}
	rw.WriteHeader(200)
	rw.Write(body)
}

func AddHandler(rw http.ResponseWriter, req *http.Request) {
	addHeaders(rw)
	if req.Method == "OPTIONS" {
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Error begining transaction: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		return
	}

	item := &Item{}
	if err := json.NewDecoder(req.Body).Decode(item); err != nil {
		log.Printf("Error decoding request: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}

	item.ID = fmt.Sprintf("%x", rand.Int63())
	_, err = tx.Exec(
		"INSERT INTO items (id, description) VALUES (?, ?)",
		item.ID, item.Description,
	)
	if err != nil {
		log.Printf("Error inserting item: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing item: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}
	req.URL.RawQuery = ""
	req.URL.Fragment = ""
	rw.Header().Add("Location", req.URL.String()+"/"+item.ID)
	rw.WriteHeader(201)
	json.NewEncoder(rw).Encode(item)
}

func UpdateHandler(rw http.ResponseWriter, req *http.Request) {
	addHeaders(rw)
	if req.Method == "OPTIONS" {
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		log.Printf("Error begining transaction: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		return
	}

	newitem := &Item{}
	if err := json.NewDecoder(req.Body).Decode(newitem); err != nil {
		log.Printf("Error decoding request: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}
	vars := mux.Vars(req)
	newitem.ID = vars["id"]
	if newitem.ID == "" {
		log.Printf("Empty ID: %v", vars)
		rw.WriteHeader(400)
		rw.Write([]byte("missing id id"))
		tx.Rollback()
		return
	}

	{
		olditem := &Item{ID: "id"}
		row := tx.QueryRow("SELECT * FROM items WHERE id = ? LIMIT 1", newitem.ID)
		if err := row.Scan(&olditem.ID, &olditem.Description, &olditem.User); err != nil {
			log.Printf("Error querying item: %v", err)
			rw.WriteHeader(500)
			rw.Write([]byte("oops"))
			tx.Rollback()
			return
		}
		newitem.Description = olditem.Description
	}

	_, err = tx.Exec(
		"UPDATE items SET description = ?, user = ? WHERE id = ?",
		newitem.Description, newitem.User, newitem.ID,
	)
	if err != nil {
		log.Printf("Error updating item: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing item: %v", err)
		rw.WriteHeader(500)
		rw.Write([]byte("oops"))
		tx.Rollback()
		return
	}
	req.URL.RawQuery = ""
	req.URL.Fragment = ""
	rw.Header().Add("Location", req.URL.String()+"/"+newitem.ID)
	rw.WriteHeader(201)
	json.NewEncoder(rw).Encode(newitem)
}

func createTable(table, create string) {
	create = fmt.Sprintf(create, table)

	tx, err := DB.Begin()
	if err != nil {
		log.Fatalf("Error beginning transaction: %v", err)
	}

	row := tx.QueryRow("SELECT COUNT(1) FROM sqlite_master WHERE type = ? AND name = ?", "table", table)
	count := 0
	if err := row.Scan(&count); err != nil {
		log.Fatalf("Error reading results of '%s' table check: %v", table, err)
	}

	if count > 0 {
		tx.Rollback()
		return
	}
	if _, err := tx.Exec(create); err != nil {
		log.Fatalf("Error creating table %s: %v", table, err)
	}
	if err := tx.Commit(); err != nil {
		log.Fatalf("Error commiting table creation %s: %v", table, err)
	}
}

func main() {
	log.SetFlags(log.Ldate | log.Lmicroseconds | log.Lshortfile)
	bind := flag.String("bind", "localhost:8000", "host:port to listen on")
	dbFile := flag.String("db", "signup.sqlite3", "filename for db")
	flag.Parse()

	router, err := setup(*dbFile)
	if err != nil {
		log.Fatalf("Error starting up: %v", err)
	}
	m := http.NewServeMux()
	m.Handle("/", router)

	log.Printf("Starting %s on http://%s", path.Base(os.Args[0]), *bind)
	log.Fatal(http.ListenAndServe(*bind, m))
}

func initDB() {
	createTable("items", "CREATE TABLE %s ( id TEXT PRIMARY KEY, description TEXT NOT NULL DEFAULT '', user TEXT NOT NULL DEFAULT '' )")
}

func setup(dbFile string) (*mux.Router, error) {
	var err error
	if DB, err = sql.Open("sqlite3", dbFile); err != nil {
		return nil, fmt.Errorf("Error opening database: %v", err)
	}

	initDB()

	r := mux.NewRouter()
	r.HandleFunc("/api/list", GetHandler).Methods("GET", "OPTIONS")
	r.HandleFunc("/api/list", AddHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/list/{id}", UpdateHandler).Methods("POST", "OPTIONS")

	return r, nil
}
