<script lang="ts">
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
    import * as InputGroup from "$lib/components/ui/input-group/index.js";
    import DropdownMenuContent from "@/components/ui/dropdown-menu/dropdown-menu-content.svelte";
    import DropdownMenuTrigger from "@/components/ui/dropdown-menu/dropdown-menu-trigger.svelte";
    import InputGroupAddon from "@/components/ui/input-group/input-group-addon.svelte";
    import { getLocalTimeZone, today } from "@internationalized/date";
    import { Calendar } from "$lib/components/ui/calendar/index.js";
    import * as Dialog from "$lib/components/ui/dialog/index.js";
    import DialogTrigger from "@/components/ui/dialog/dialog-trigger.svelte";
    import DialogContent from "@/components/ui/dialog/dialog-content.svelte";
    import * as Field from "$lib/components/ui/field/index.js";
    import Button from "@/components/ui/button/button.svelte";
    import Input from "@/components/ui/input/input.svelte";
    import { supabase } from "$lib/supabaseClient.js";
    import { onMount, onDestroy } from "svelte";
    import { CalendarPlus, SendHorizontal } from "@lucide/svelte"
    import { buttonVariants } from "@/components/ui/button/button.svelte";
    import { cn } from "@/utils";
    import * as NavigationMenu from "$lib/components/ui/navigation-menu/index.js";
    
    type Item = {
        item_id: string;
        user_id: string;
        text: string;
        checked: boolean;
        date: string;
        deleted: boolean;
    };
    
    type User ={
        user_id: string;
        type: string;
    }
    
    let value = $state(today(getLocalTimeZone()));
    let list = $state<Item[]>([]); // keep the list as reactive state
    let input = $state('');
    let email = $state('');
    let password = $state('');
    let currentUserId = $state('');
    let dashboard = $state(false)
    let users = $state<User[]>([])
    let signin = $state(true)
    let error_message = $state('')
    let email_sent = $state(false)
    
    supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN') userId(); loadItems()
        if (event === 'SIGNED_OUT') currentUserId = ''; list = []; dashboard = false
    })
    
    onMount(async() => {
        loadItems();
        await loadUsers();
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
    
    async function loadUsers() {
        const { data } = await supabase.from("users").select("*").eq("type", "dashboard");
        users = data ?? [];
    }
    
    async function userId() {
        const { data } = await supabase.auth.getUser();
        if (data.user) {
            currentUserId = data.user.id;
            if (users.some(u => u.user_id === currentUserId)) {
                dashboard = true
            }
        }
    }
    
    async function signIn() {
        const { error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        })
        if (error) {
            error_message = error.message 
        }
    }
    
    async function signUp() {
        const { error } = await supabase.auth.signUp({
            email: email,
            password: password,
        })
        if (error) {
            error_message = error.message
        } else { email_sent = true }
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

    async function databaseAdd(item: Item) {
        await supabase
        .from('Items')
        .update({ 'database': true })
        .eq('item_id', item.item_id)  // ← Add this: filter by primary key
        .select();          // Optional: returns updated row(s)
    }
    
    async function itemsToList(e: KeyboardEvent) {
        if (e.key !== 'Enter') return
        
        e.preventDefault()
        if (!input.trim()) return
        
        await supabase
        .from('Items')
        .insert({'user_id': currentUserId, 'item_id': crypto.randomUUID(), 'text': input.trim(), 'checked': false, 'date': value.toString().split('T')[0], 'deleted': false})
        .select()
        input=''
        value=today(getLocalTimeZone())
    }
</script>
{#if dashboard}
<NavigationMenu.Root>
    <NavigationMenu.List>
        <NavigationMenu.Item>
            <NavigationMenu.Link class="hover:cursor-pointer text-2xl" href="/dashboard">Dashboard</NavigationMenu.Link>
        </NavigationMenu.Item>
    </NavigationMenu.List>
</NavigationMenu.Root>
{/if}
<div class="flex justify-end mt-5 mr-5">
    {#if !currentUserId}
    <Dialog.Root>
        <DialogTrigger class={buttonVariants({ variant: "default" })} type="button">
            Sign In!
        </DialogTrigger>
        <DialogContent>
            {#if !email_sent}
            <form>
                <Field.Group>
                    <Field.Field>
                        <Field.Label for="email">
                            Email
                        </Field.Label>
                        <Input id="email" bind:value={email} oninput={() => error_message = ''} type="email" autocomplete="on" />
                        </Field.Field>
                        <Field.Field>
                            <Field.Label for="password">
                                Password
                            </Field.Label>
                            <Input id="password" bind:value={password} onclick={() => error_message = ''} type="password" autocomplete="on" />
                            </Field.Field>
                            {#if error_message}
                            <p class="text-red-500 inline-flex justify-center text-sm">{error_message}</p>
                            {/if}
                            {#if signin}
                            <Button type="button" onclick={() => signIn()}>
                                Sign In
                            </Button>
                            {:else}
                            <Button type="button" onclick={() => signUp()}>
                                Sign Up
                            </Button>
                            {/if}
                        </Field.Group>
                    </form>
                    <button class="flex place-self-center" onclick={() => signin = !signin}>
                        <p class="hover:cursor-pointer">{signin ? "Don't have an account?" : "Have an account?"}</p>
                    </button>
                    {:else}
                    <p class="text-3xl">Email was sent to inbox!</p>
                    <Button onclick={() => email_sent = !email_sent}>Alright</Button>
                    {/if}
                </DialogContent>
            </Dialog.Root>
            {:else}
            <Button onclick={() => signOut()}>Sign Out</Button>
            {/if}
        </div>
        <div class="grid grid-cols-1 w-1/2 mx-auto">
            <h6 class="text-7xl font-chewy">Community</h6>
            {#if currentUserId}
            <InputGroup.Root class="mt-10 h-15">
                <InputGroup.Input id="input" class="text-2xl!" onkeypress={itemsToList} contenteditable="true" bind:value={input} />
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
            {:else}
            <h6 class="text-2xl">Please Sign In to Participate</h6>
            {/if}
            {#each list as item (item.item_id)}
            <div class="flex justify-between my-5">
                <div class="flex gap-2 place-items-center">
                    <SendHorizontal color="black" onclick={() => databaseAdd(item)} />
                    <p class={cn( item.checked ? 'line-through' : '', "text-2xl" )}>{item.text}</p>
                </div>
                <div class="flex gap-5 items-center">
                    {item.date}
                </div>
            </div>
            {/each}
        </div>