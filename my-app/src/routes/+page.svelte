<script lang="ts">
    interface Item {
        id: string;
        checked: boolean;
    }
    
    let input = $state('')
    let list = $state<Item[]>([])
    
    function check(item: Item) {
        item.checked = !item.checked
        list = list;
    }
    
    function itemsToList(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        
        e.preventDefault()
        if (!input.trim()) return
        
        list.push({id: input, checked: false})
        input=''
    }
</script>
<input type="text" class="input" onkeypress={itemsToList} contenteditable="true" bind:value={input}>
<ol class="list">
    {#each list as item (item.id)}
    <li class="list-row">
        <input type="checkbox" class="checkbox" onclick={() => check(item)}><p class="{item.checked ? 'line-through': ''}">{item.id}</p>
    </li>
    {/each}
</ol>