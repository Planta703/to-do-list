<script lang="ts">
    interface Item {
        id: string;
        text: string;
        checked: boolean;
    }
    
    let input = $state('')
    let list = $state<Item[]>([])
    
    function check(item: Item) {
        item.checked = !item.checked
        list = list;
        list.sort((a, b) => Number(a.checked) - Number(b.checked))
    }
    
    function itemsToList(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        
        e.preventDefault()
        if (!input.trim()) return
        
        list.unshift({id: crypto.randomUUID(), text: input.trim(), checked: false})
        input=''
    }
</script>
<input type="text" class="input" onkeypress={itemsToList} contenteditable="true" bind:value={input}>
<ol class="list">
    {#each list as item (item.id)}
    <li class="list-row">
        <input type="checkbox" class="checkbox" onclick={() => check(item)}><p class="{item.checked ? 'line-through': ''}">{item.text}</p>
    </li>
    {/each}
</ol>