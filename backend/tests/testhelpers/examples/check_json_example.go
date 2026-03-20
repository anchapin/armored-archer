package main

import (
	"encoding/json"
	"fmt"
	"testhelpers"
)

func main() {
	player := testhelpers.NewTestPlayer()
	player.UserID = "test_player"
	b, _ := json.Marshal(player)
	fmt.Println("Player JSON:")
	fmt.Println(string(b))

	gear := testhelpers.NewTestGear()
	gear.ID = "test_gear"
	gear.Type = "bow"
	b, _ = json.Marshal(gear)
	fmt.Println("\nGear JSON:")
	fmt.Println(string(b))

	match := testhelpers.NewTestMatch()
	match.MatchID = "test_match"
	b, _ = json.Marshal(match)
	fmt.Println("\nMatch JSON:")
	fmt.Println(string(b))
}
