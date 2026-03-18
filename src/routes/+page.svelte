<script lang="ts">
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import * as InputGroup from "$lib/components/ui/input-group/index.js";
    import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.svelte";
    import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte";
    import InputGroupAddon from "@/components/ui/input-group/input-group-addon.svelte";
    import { getLocalTimeZone, today, parseDate } from "@internationalized/date";
    import { Calendar } from "$lib/components/ui/calendar/index.js";
    import { Checkbox } from "$lib/components/ui/checkbox/index.js";
    import { Label } from "$lib/components/ui/label/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import DialogTrigger from "@/components/ui/dialog/dialog-trigger.svelte";
    import DialogContent from "@/components/ui/dialog/dialog-content.svelte";
    import * as Field from "$lib/components/ui/field/index.js";
    import Button from "@/components/ui/button/button.svelte";
    import Input from "@/components/ui/input/input.svelte";
    import { supabase } from "$lib/supabaseClient.js";
    import { onMount, onDestroy } from "svelte";
    import { CalendarPlus, ChevronDown, Trash2 } from "@lucide/svelte"
    import { buttonVariants } from "@/components/ui/button/button.svelte";
    import { cn } from "@/utils";
    
    type Item = {
        item_id: string;
        user_id: string;
        text: string;
        checked: boolean;
        date: string;
        deleted: boolean;
    };
    
    let value = $state(today(getLocalTimeZone()));
    let list = $state<Item[]>([]); // keep the list as reactive state
    let input = $state('');
    let email = $state('');
    let password = $state('');
    let currentUserId = $state('');
    
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') userId()
        if (event === 'SIGNED_OUT') currentUserId = ''; loadItems()
    })
    
    onMount(() => {
        loadItems();
        userId()
        
        const subscription = supabase
        .channel("public:Items")
        .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Items" },
        (payload) => {
            const row = (payload.new ?? payload.old) as Item | null;
            if (!row) return;
            
            if (payload.eventType === "INSERT") {
                list = [...list, row];
            } else if (payload.eventType === "UPDATE") {
                if (row.deleted) {
                    list = list.filter((item) => item.item_id !== row.item_id)
                } else {
                    list = list.map((item) =>
                    item.item_id === row.item_id ? row : item
                    );
                }
            }
        }
        )
        .subscribe();
        
        onDestroy(() => {
            supabase.removeChannel(subscription);
        });
    });
    
    async function loadItems() {
        const { data } = await supabase.from("Items").select("*").eq("deleted", false);
        list = data ?? [];
    }
    
    async function userId() {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
            currentUserId = data.user.id;
        }
    }
    
    async function check(item: Item) {
        await supabase
        .from('Items')
        .update({ 'checked': item.checked })
        .eq('item_id', item.item_id)  // ← Add this: filter by primary key
        .select();          // Optional: returns updated row(s)
    }
    
    async function deleteItem(item: Item) {
        await supabase
        .from('Items')
        .update({ 'deleted': true })
        .eq('item_id', item.item_id)  // ← Add this: filter by primary key
        .select();          // Optional: returns updated row(s)
    }
    
    async function signIn() {
        await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        })
    }
    
    async function signOut() {
        await supabase.auth.signOut({ scope: 'local' })
    }
    
    $effect(() => {
        list.sort((a, b) => {
            if (a.checked !== b.checked) {
                return Number(a.checked) - Number(b.checked)
            }
            
            if (a.checked) {
                if (a.date > b.date) return -1;
                if (a.date < b.date) return 1;
            } else {
                if (a.date < b.date) return -1;
                if (a.date > b.date) return 1;
            }
            
            return 0;
        })
    })
    
    async function itemsToList(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        
        e.preventDefault()
        if (!input.trim()) return
        
        const {error} = await supabase
        .from('Items')
        .insert({'user_id': currentUserId, 'item_id': crypto.randomUUID(), 'text': input.trim(), 'checked': false, 'date': value.toString().split('T')[0], 'deleted': false})
        .select()
        input=''
        value=today(getLocalTimeZone())
        
        if (error) throw error
    }
</script>
<div class="flex justify-end mt-5 mr-5">
    {#if !currentUserId}
    <Dialog.Root>
        <DialogTrigger class={buttonVariants({ variant: "default" })} type="button">
            Sign In!
        </DialogTrigger>
        <DialogContent>
            <form>
                <Field.Group>
                    <Field.Field>
                        <Field.Label>
                            Email
                        </Field.Label>
                        <Input bind:value={email} type="email" />
                    </Field.Field>
                    <Field.Field>
                        <Field.Label>
                            Password
                        </Field.Label>
                        <Input bind:value={password} type="password" />
                    </Field.Field>
                    <Button type="button" onclick={() => signIn()}>
                        Sign In
                    </Button>
                </Field.Group>
            </form>
        </DialogContent>
    </Dialog.Root>
    {:else}
    <Button onclick={() => signOut()}>Sign Out</Button>
    {/if}
</div>
<div class="grid grid-cols-1 w-1/2 mx-auto">
    <h6 class="text-7xl font-chewy">Community</h6>
    <InputGroup.Root class="mt-10 h-15">
        <InputGroup.Input class="text-2xl!" onkeypress={itemsToList} contenteditable="true" bind:value={input} />
        <InputGroupAddon align="inline-end">
            <DropdownMenu.Root>
                <DropdownMenuTrigger>
                    <CalendarPlus color="black" />
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <Calendar
                    type="single"
                    bind:value
                    class="rounded-md border shadow-sm"
                    captionLayout="dropdown"
                    />
                </DropdownMenuContent>
            </DropdownMenu.Root>
        </InputGroupAddon>
    </InputGroup.Root>
    {#each list as item (item.item_id)}
    <div class="flex justify-between mt-5">
        <div class="flex gap-2 place-items-center">
            <Checkbox id={item.item_id}  onCheckedChange={() => check(item)} bind:checked={item.checked} />
                <Label for={item.item_id} class={cn( item.checked ? 'line-through' : '', "text-2xl" )}>{item.text}</Label>
            </div>
            <div class="flex gap-5 items-center">
                <DropdownMenu.Root>
                    <DropdownMenuTrigger class="flex items-center gap-1">
                        {item.date}
                        <ChevronDown color="black" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <Calendar
                        type="single"
                        value={parseDate(item.date)}
                        onValueChange={(newVal) => {
                            if (newVal) item.date = newVal.toString();
                        }}
                        class="rounded-md border shadow-sm"
                        captionLayout="dropdown"
                        />
                    </DropdownMenuContent>
                </DropdownMenu.Root>
                <Trash2 size=20 onclick={() => deleteItem(item)} />
                </div>
            </div>
            {/each}
        </div>