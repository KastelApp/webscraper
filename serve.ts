
Bun.serve({
	fetch: async () => {
        const file = Bun.file("example.html")
        
        const text = await file.text()
        
		return new Response(text, {
            headers: {
                "Content-Type": "text/html"
            }
        });
	},
    port: 8989
});

console.log("Bun is served on port 8989");
